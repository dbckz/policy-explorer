// Policy Orbit - Explorer UI App

(function() {
    'use strict';

    // State
    let state = {
        data: null,
        hierarchy: null,
        currentNodeId: null,
        expandedTreeNodes: new Set(),
        searchTerm: ''
    };

    // Helper: Build flat index of hierarchy for quick lookups
    function buildHierarchyIndex(node, parent = null, path = []) {
        const currentPath = [...path, node.name];
        const nodeId = currentPath.join('/');

        const indexed = {
            id: nodeId,
            name: node.name,
            type: node.type,
            path: currentPath,
            parent: parent,
            children: [],
            childrenData: node.children || []
        };

        if (node.children) {
            indexed.children = node.children.map(child =>
                buildHierarchyIndex(child, indexed, currentPath)
            );
        }

        return indexed;
    }

    // Helper: Find node in hierarchy by ID
    function findNodeById(node, targetId) {
        if (node.id === targetId) return node;
        for (const child of node.children) {
            const found = findNodeById(child, targetId);
            if (found) return found;
        }
        return null;
    }

    // Helper: Get all descendants (for counting)
    function getDescendants(node) {
        let descendants = [];
        for (const child of node.children) {
            descendants.push(child);
            descendants = descendants.concat(getDescendants(child));
        }
        return descendants;
    }

    // Helper: Get CRM data for a node
    function getCrmData(nodeId) {
        // Convert hierarchy nodeId to CRM ID format
        const parts = nodeId.split('/');
        const crmId = parts.map(p => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('/');

        return state.data.organizations[crmId] || null;
    }

    // Helper: Get priority color for a node
    function getPriorityColor(nodeId) {
        const crm = getCrmData(nodeId);
        if (!crm) return 'var(--priority-unknown)';
        return Utils.PRIORITY_LEVELS[crm.priority]?.color || 'var(--priority-unknown)';
    }

    // Helper: Get type color
    function getTypeColor(type) {
        const colors = {
            root: 'var(--type-root)',
            main_category: 'var(--type-main_category)',
            category: 'var(--type-category)',
            subcategory: 'var(--type-subcategory)',
            entity: 'var(--type-entity)'
        };
        return colors[type] || 'var(--type-entity)';
    }

    // Initialize
    async function init() {
        try {
            state.data = await API.getData();
            state.hierarchy = buildHierarchyIndex(state.data.hierarchy);

            // Expand root by default
            state.expandedTreeNodes.add(state.hierarchy.id);

            renderTree();
            setupEventListeners();

            // Select root by default
            selectNode(state.hierarchy.id);
        } catch (err) {
            console.error('Init error:', err);
        }
    }

    // Render tree
    function renderTree() {
        const container = document.getElementById('tree-container');
        container.innerHTML = renderTreeNode(state.hierarchy, 0);
        attachTreeListeners();
    }

    // Render a single tree node
    function renderTreeNode(node, depth) {
        const hasChildren = node.children.length > 0;
        const isExpanded = state.expandedTreeNodes.has(node.id);
        const isActive = state.currentNodeId === node.id;
        const isInPath = state.currentNodeId && state.currentNodeId.startsWith(node.id + '/');
        const priorityColor = getPriorityColor(node.id);

        // Filter by search
        if (state.searchTerm) {
            const matchesSelf = node.name.toLowerCase().includes(state.searchTerm);
            const hasMatchingDescendant = getDescendants(node).some(d =>
                d.name.toLowerCase().includes(state.searchTerm)
            );
            if (!matchesSelf && !hasMatchingDescendant) {
                return '';
            }
        }

        const childCount = node.children.length;

        let html = `
            <div class="tree-node" data-id="${node.id}">
                <div class="tree-node-row ${isActive ? 'active' : ''} ${isInPath ? 'in-path' : ''}" data-id="${node.id}">
                    <span class="tree-toggle ${hasChildren ? 'has-children' : ''}" data-id="${node.id}">
                        ${hasChildren ? (isExpanded ? '▼' : '▶') : ''}
                    </span>
                    <span class="tree-dot" style="background: ${priorityColor}"></span>
                    <span class="tree-label">${escapeHtml(node.name)}</span>
                    ${childCount > 0 ? `<span class="tree-count">${childCount}</span>` : ''}
                </div>
        `;

        if (hasChildren) {
            html += `<div class="tree-children ${isExpanded ? 'expanded' : ''}">`;
            for (const child of node.children) {
                html += renderTreeNode(child, depth + 1);
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // Attach tree event listeners
    function attachTreeListeners() {
        // Toggle expand/collapse
        document.querySelectorAll('.tree-toggle.has-children').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = toggle.dataset.id;
                if (state.expandedTreeNodes.has(nodeId)) {
                    state.expandedTreeNodes.delete(nodeId);
                } else {
                    state.expandedTreeNodes.add(nodeId);
                }
                renderTree();
            });
        });

        // Select node
        document.querySelectorAll('.tree-node-row').forEach(row => {
            row.addEventListener('click', () => {
                selectNode(row.dataset.id);
            });
        });
    }

    // Select a node
    function selectNode(nodeId) {
        state.currentNodeId = nodeId;

        // Auto-expand path to node
        const parts = nodeId.split('/');
        let pathId = '';
        for (const part of parts) {
            pathId = pathId ? `${pathId}/${part}` : part;
            state.expandedTreeNodes.add(pathId);
        }

        renderTree();
        renderCurrentNode();
        renderBreadcrumb();
        renderRelated();
        updateStats();
    }

    // Render current node details
    function renderCurrentNode() {
        const node = findNodeById(state.hierarchy, state.currentNodeId);
        if (!node) return;

        // Update header
        document.getElementById('node-name').textContent = node.name;
        const badge = document.getElementById('node-type-badge');
        badge.textContent = node.type.replace('_', ' ');
        badge.className = `node-type-badge ${node.type}`;

        // Show/hide CRM fields based on type
        const crmSection = document.getElementById('node-crm');
        const crm = getCrmData(node.id);

        if (crm) {
            crmSection.style.display = 'flex';
            populateCrmFields(crm);
        } else {
            crmSection.style.display = 'none';
        }
    }

    // Populate CRM fields
    function populateCrmFields(crm) {
        // Priority
        document.querySelectorAll('#priority-btns button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === crm.priority);
        });

        // Stage
        document.querySelectorAll('#stage-btns button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === crm.relationshipStage);
        });

        // Scores
        document.querySelectorAll('.score-btns').forEach(group => {
            const field = group.dataset.field;
            const value = crm[field];
            group.querySelectorAll('button').forEach(btn => {
                const btnVal = btn.dataset.value === 'null' ? null : parseInt(btn.dataset.value);
                btn.classList.toggle('active', btnVal === value);
            });
        });

        // Tags
        renderTags(crm);

        // Dates
        document.getElementById('last-contacted').value = crm.lastContacted || '';
        document.getElementById('next-action').value = crm.nextAction || '';
        document.getElementById('notes').value = crm.notes || '';
    }

    // Render tags
    function renderTags(crm) {
        const container = document.getElementById('tags-wrap');
        container.innerHTML = state.data.availableTags.map(tag => {
            const isActive = crm.tags.includes(tag);
            return `<span class="tag-chip ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`;
        }).join('');

        container.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => toggleTag(chip.dataset.tag));
        });
    }

    // Toggle tag
    async function toggleTag(tag) {
        const crm = getCrmData(state.currentNodeId);
        if (!crm) return;
        const newTags = crm.tags.includes(tag)
            ? crm.tags.filter(t => t !== tag)
            : [...crm.tags, tag];
        await updateCrm({ tags: newTags });
    }

    // Update CRM data
    async function updateCrm(updates) {
        const node = findNodeById(state.hierarchy, state.currentNodeId);
        if (!node) return;

        const parts = state.currentNodeId.split('/');
        const crmId = parts.map(p => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('/');

        try {
            const updated = await API.updateOrg(crmId, updates);
            state.data.organizations[crmId] = updated;

            // Refresh UI
            renderCurrentNode();
            renderTree();
            renderRelated();
            updateStats();
        } catch (err) {
            console.error('Update failed:', err);
        }
    }

    // Render breadcrumb
    function renderBreadcrumb() {
        const node = findNodeById(state.hierarchy, state.currentNodeId);
        if (!node) return;

        const container = document.getElementById('breadcrumb');
        const parts = node.path;

        let html = '';
        let pathSoFar = '';

        for (let i = 0; i < parts.length; i++) {
            pathSoFar = pathSoFar ? `${pathSoFar}/${parts[i]}` : parts[i];
            const isCurrent = i === parts.length - 1;

            if (i > 0) {
                html += '<span class="breadcrumb-sep">›</span>';
            }

            html += `<span class="breadcrumb-item ${isCurrent ? 'current' : ''}" data-id="${pathSoFar}">${escapeHtml(parts[i])}</span>`;
        }

        container.innerHTML = html;

        // Attach click handlers
        container.querySelectorAll('.breadcrumb-item:not(.current)').forEach(item => {
            item.addEventListener('click', () => selectNode(item.dataset.id));
        });
    }

    // Render related nodes (parent, siblings, children)
    function renderRelated() {
        const node = findNodeById(state.hierarchy, state.currentNodeId);
        if (!node) return;

        // Parent
        const parentGroup = document.getElementById('parent-group');
        const parentCards = document.getElementById('parent-cards');
        if (node.parent) {
            parentGroup.style.display = 'block';
            parentCards.innerHTML = renderRelatedCard(node.parent);
        } else {
            parentGroup.style.display = 'none';
        }

        // Siblings
        const siblingsGroup = document.getElementById('siblings-group');
        const siblingsCards = document.getElementById('siblings-cards');
        const siblingsCount = document.getElementById('siblings-count');
        if (node.parent) {
            const siblings = node.parent.children.filter(c => c.id !== node.id);
            siblingsCount.textContent = `(${siblings.length})`;
            if (siblings.length > 0) {
                siblingsGroup.style.display = 'block';
                siblingsCards.innerHTML = siblings.map(s => renderRelatedCard(s)).join('');
            } else {
                siblingsGroup.style.display = 'none';
            }
        } else {
            siblingsGroup.style.display = 'none';
        }

        // Children
        const childrenGroup = document.getElementById('children-group');
        const childrenCards = document.getElementById('children-cards');
        const childrenCount = document.getElementById('children-count');
        childrenCount.textContent = `(${node.children.length})`;
        if (node.children.length > 0) {
            childrenGroup.style.display = 'block';
            childrenCards.innerHTML = node.children.map(c => renderRelatedCard(c)).join('');
        } else {
            childrenGroup.style.display = 'none';
        }

        // Attach click handlers
        document.querySelectorAll('.related-card').forEach(card => {
            card.addEventListener('click', () => {
                selectNode(card.dataset.id);
                card.classList.add('highlight-flash');
            });
        });
    }

    // Render a related card
    function renderRelatedCard(node) {
        const priorityColor = getPriorityColor(node.id);
        const crm = getCrmData(node.id);
        const stageInfo = crm ? Utils.RELATIONSHIP_STAGES[crm.relationshipStage] : null;

        return `
            <div class="related-card" data-id="${node.id}">
                <span class="card-dot" style="background: ${priorityColor}"></span>
                <div class="card-info">
                    <div class="card-name">${escapeHtml(node.name)}</div>
                    <div class="card-type">${node.type.replace('_', ' ')}</div>
                </div>
                ${stageInfo && crm.relationshipStage !== 'unknown' ?
                    `<span class="card-badge" style="background: ${stageInfo.color}">${stageInfo.label}</span>` : ''
                }
            </div>
        `;
    }

    // Update stats
    function updateStats() {
        const node = findNodeById(state.hierarchy, state.currentNodeId);
        if (!node) return;

        // Depth
        document.getElementById('stat-depth').textContent = node.path.length;

        // Branch total
        const descendants = getDescendants(node);
        const branchNodes = [node, ...descendants];
        const entityNodes = branchNodes.filter(n => n.type === 'entity' || n.type === 'subcategory' || n.type === 'category');
        document.getElementById('stat-branch-total').textContent = entityNodes.length;

        // Branch triaged
        const triaged = entityNodes.filter(n => {
            const crm = getCrmData(n.id);
            return crm && crm.priority !== 'unknown';
        }).length;
        document.getElementById('stat-branch-triaged').textContent = triaged;

        // Global progress
        const allOrgs = Object.values(state.data.organizations);
        const globalTriaged = allOrgs.filter(o => o.priority !== 'unknown').length;
        const total = allOrgs.length;
        document.getElementById('global-progress').textContent = `${globalTriaged} / ${total} triaged`;
        document.getElementById('progress-fill').style.width = `${(globalTriaged / total) * 100}%`;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search
        document.getElementById('tree-search').addEventListener('input', Utils.debounce((e) => {
            state.searchTerm = e.target.value.toLowerCase();
            renderTree();
        }, 200));

        // Expand/Collapse all
        document.getElementById('btn-expand-all').addEventListener('click', () => {
            expandAll(state.hierarchy);
            renderTree();
        });

        document.getElementById('btn-collapse-all').addEventListener('click', () => {
            state.expandedTreeNodes.clear();
            state.expandedTreeNodes.add(state.hierarchy.id);
            renderTree();
        });

        // CRM field listeners
        document.querySelectorAll('#priority-btns button').forEach(btn => {
            btn.addEventListener('click', () => updateCrm({ priority: btn.dataset.value }));
        });

        document.querySelectorAll('#stage-btns button').forEach(btn => {
            btn.addEventListener('click', () => updateCrm({ relationshipStage: btn.dataset.value }));
        });

        document.querySelectorAll('.score-btns').forEach(group => {
            const field = group.dataset.field;
            group.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value === 'null' ? null : parseInt(btn.dataset.value);
                    updateCrm({ [field]: value });
                });
            });
        });

        document.getElementById('last-contacted').addEventListener('change', (e) => {
            updateCrm({ lastContacted: e.target.value || null });
        });

        document.getElementById('btn-today').addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('last-contacted').value = today;
            updateCrm({ lastContacted: today });
        });

        document.getElementById('next-action').addEventListener('change', (e) => {
            updateCrm({ nextAction: e.target.value });
        });

        document.getElementById('notes').addEventListener('change', (e) => {
            updateCrm({ notes: e.target.value });
        });

        // Export/Import
        document.getElementById('btn-export').addEventListener('click', () => API.exportData());
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', handleImport);
    }

    // Expand all nodes
    function expandAll(node) {
        state.expandedTreeNodes.add(node.id);
        for (const child of node.children) {
            expandAll(child);
        }
    }

    // Handle import
    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await API.importData(data);
            state.data = await API.getData();
            renderTree();
            selectNode(state.currentNodeId);
            alert('Data imported successfully');
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
        e.target.value = '';
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Start
    init();
})();
