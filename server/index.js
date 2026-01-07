const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Data file paths
const HIERARCHY_FILE = path.join(__dirname, '..', 'data.json');
const CRM_FILE = path.join(__dirname, '..', 'crm-data.json');

// Helper: Generate org ID from path
function generateOrgId(name, parentPath = '') {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return parentPath ? `${parentPath}/${slug}` : slug;
}

// Helper: Flatten hierarchy into org list
function flattenHierarchy(node, parentPath = '', category = '') {
    const orgs = [];
    const id = generateOrgId(node.name, parentPath);

    // Build category breadcrumb
    let currentCategory = category;
    if (node.type !== 'root') {
        currentCategory = category ? `${category} > ${node.name}` : node.name;
    }

    // Only add leaf nodes and category nodes as trackable orgs
    if (node.type === 'entity' || node.type === 'subcategory' || node.type === 'category') {
        orgs.push({
            id,
            name: node.name,
            type: node.type,
            category: category,
            parentPath
        });
    }

    // Recurse into children
    if (node.children) {
        for (const child of node.children) {
            orgs.push(...flattenHierarchy(child, id, currentCategory));
        }
    }

    return orgs;
}

// Helper: Initialize CRM data from hierarchy
function initializeCrmData() {
    const hierarchy = JSON.parse(fs.readFileSync(HIERARCHY_FILE, 'utf-8'));
    const flatOrgs = flattenHierarchy(hierarchy);

    const organizations = {};
    for (const org of flatOrgs) {
        organizations[org.id] = {
            id: org.id,
            name: org.name,
            type: org.type,
            category: org.category,
            priority: 'unknown',
            relationshipStage: 'unknown',
            influenceScore: null,
            accessibilityScore: null,
            alignmentScore: null,
            tags: [],
            notes: '',
            lastContacted: null,
            nextAction: '',
            nextActionDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    return {
        organizations,
        availableTags: [
            'AI Safety',
            'Data Protection',
            'Pro-Regulation',
            'Industry-Friendly',
            'Key Ally',
            'Gatekeeper',
            'Thought Leader',
            'Funding Source',
            'Technical Expert',
            'Policy Maker'
        ],
        hierarchy: hierarchy,
        lastUpdated: new Date().toISOString()
    };
}

// Helper: Load or initialize CRM data
function loadCrmData() {
    try {
        if (fs.existsSync(CRM_FILE)) {
            return JSON.parse(fs.readFileSync(CRM_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('Error loading CRM data:', err);
    }

    // Initialize fresh data
    const data = initializeCrmData();
    saveCrmData(data);
    return data;
}

// Helper: Save CRM data
function saveCrmData(data) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CRM_FILE, JSON.stringify(data, null, 2));
}

// API Routes

// Get all CRM data
app.get('/api/data', (req, res) => {
    try {
        const data = loadCrmData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single organization
app.get('/api/orgs/:id(*)', (req, res) => {
    try {
        const data = loadCrmData();
        const org = data.organizations[req.params.id];
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update organization
app.patch('/api/orgs/:id(*)', (req, res) => {
    try {
        const data = loadCrmData();
        const orgId = req.params.id;

        if (!data.organizations[orgId]) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Update fields
        const updates = req.body;
        const org = data.organizations[orgId];

        const allowedFields = [
            'priority', 'relationshipStage', 'influenceScore',
            'accessibilityScore', 'alignmentScore', 'tags',
            'notes', 'lastContacted', 'nextAction', 'nextActionDate'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                org[field] = updates[field];
            }
        }

        org.updatedAt = new Date().toISOString();
        saveCrmData(data);

        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk update organizations
app.patch('/api/orgs', (req, res) => {
    try {
        const data = loadCrmData();
        const updates = req.body; // { orgId: { field: value }, ... }

        for (const [orgId, orgUpdates] of Object.entries(updates)) {
            if (data.organizations[orgId]) {
                Object.assign(data.organizations[orgId], orgUpdates);
                data.organizations[orgId].updatedAt = new Date().toISOString();
            }
        }

        saveCrmData(data);
        res.json({ success: true, updated: Object.keys(updates).length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add custom tag
app.post('/api/tags', (req, res) => {
    try {
        const data = loadCrmData();
        const { tag } = req.body;

        if (!tag || typeof tag !== 'string') {
            return res.status(400).json({ error: 'Invalid tag' });
        }

        if (!data.availableTags.includes(tag)) {
            data.availableTags.push(tag);
            saveCrmData(data);
        }

        res.json({ tags: data.availableTags });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete custom tag
app.delete('/api/tags/:tag', (req, res) => {
    try {
        const data = loadCrmData();
        const tag = decodeURIComponent(req.params.tag);

        data.availableTags = data.availableTags.filter(t => t !== tag);

        // Remove tag from all orgs
        for (const org of Object.values(data.organizations)) {
            org.tags = org.tags.filter(t => t !== tag);
        }

        saveCrmData(data);
        res.json({ tags: data.availableTags });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset all data (re-initialize from hierarchy)
app.post('/api/reset', (req, res) => {
    try {
        const data = initializeCrmData();
        saveCrmData(data);
        res.json({ success: true, message: 'Data reset to initial state' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export data (download as JSON)
app.get('/api/export', (req, res) => {
    try {
        const data = loadCrmData();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=policy-orbit-export-${new Date().toISOString().split('T')[0]}.json`);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import data
app.post('/api/import', (req, res) => {
    try {
        const importedData = req.body;

        // Validate structure
        if (!importedData.organizations || !importedData.availableTags) {
            return res.status(400).json({ error: 'Invalid data structure' });
        }

        saveCrmData(importedData);
        res.json({ success: true, message: 'Data imported successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Policy Orbit server running on http://localhost:${PORT}`);
});
