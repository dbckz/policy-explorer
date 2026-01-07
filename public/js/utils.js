// Policy Orbit - Shared Utilities

const PRIORITY_LEVELS = {
    unknown: { label: 'Unknown', color: '#6b7280', order: 0 },
    low: { label: 'Low', color: '#22c55e', order: 1 },
    medium: { label: 'Medium', color: '#eab308', order: 2 },
    high: { label: 'High', color: '#f97316', order: 3 },
    critical: { label: 'Critical', color: '#ef4444', order: 4 }
};

const RELATIONSHIP_STAGES = {
    unknown: { label: 'Unknown', color: '#6b7280', order: 0 },
    researching: { label: 'Researching', color: '#8b5cf6', order: 1 },
    contacted: { label: 'Contacted', color: '#3b82f6', order: 2 },
    engaged: { label: 'Engaged', color: '#14b8a6', order: 3 },
    aligned: { label: 'Aligned', color: '#22c55e', order: 4 },
    champion: { label: 'Champion', color: '#eab308', order: 5 }
};

const ORG_TYPES = {
    entity: { label: 'Organization', color: '#f39c12' },
    subcategory: { label: 'Group', color: '#2ecc71' },
    category: { label: 'Category', color: '#3498db' }
};

// Format date for display
function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Format relative time
function formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

// Calculate priority score for sorting
function getPriorityScore(org) {
    const priorityWeight = PRIORITY_LEVELS[org.priority]?.order || 0;
    const influenceWeight = (org.influenceScore || 0) * 0.5;
    return priorityWeight * 10 + influenceWeight;
}

// Filter organizations
function filterOrgs(orgs, filters) {
    return Object.values(orgs).filter(org => {
        // Type filter
        if (filters.type && filters.type !== 'all' && org.type !== filters.type) {
            return false;
        }

        // Category filter (Government vs External)
        if (filters.mainCategory) {
            const isGov = org.category.startsWith('Government');
            if (filters.mainCategory === 'government' && !isGov) return false;
            if (filters.mainCategory === 'external' && isGov) return false;
        }

        // Priority filter
        if (filters.priority && filters.priority !== 'all' && org.priority !== filters.priority) {
            return false;
        }

        // Relationship stage filter
        if (filters.stage && filters.stage !== 'all' && org.relationshipStage !== filters.stage) {
            return false;
        }

        // Tag filter
        if (filters.tags && filters.tags.length > 0) {
            const hasTag = filters.tags.some(tag => org.tags.includes(tag));
            if (!hasTag) return false;
        }

        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchName = org.name.toLowerCase().includes(searchLower);
            const matchCategory = org.category.toLowerCase().includes(searchLower);
            const matchNotes = org.notes.toLowerCase().includes(searchLower);
            if (!matchName && !matchCategory && !matchNotes) return false;
        }

        return true;
    });
}

// Sort organizations
function sortOrgs(orgs, sortBy = 'priority', sortDir = 'desc') {
    return [...orgs].sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'priority':
                aVal = PRIORITY_LEVELS[a.priority]?.order || 0;
                bVal = PRIORITY_LEVELS[b.priority]?.order || 0;
                break;
            case 'stage':
                aVal = RELATIONSHIP_STAGES[a.relationshipStage]?.order || 0;
                bVal = RELATIONSHIP_STAGES[b.relationshipStage]?.order || 0;
                break;
            case 'influence':
                aVal = a.influenceScore || 0;
                bVal = b.influenceScore || 0;
                break;
            case 'lastContacted':
                aVal = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
                bVal = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
                break;
            case 'updated':
                aVal = new Date(a.updatedAt).getTime();
                bVal = new Date(b.updatedAt).getTime();
                break;
            default:
                aVal = 0;
                bVal = 0;
        }

        if (sortDir === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
}

// Group organizations by category
function groupByCategory(orgs) {
    const groups = {};
    for (const org of orgs) {
        const topCategory = org.category.split(' > ')[0] || 'Other';
        if (!groups[topCategory]) {
            groups[topCategory] = [];
        }
        groups[topCategory].push(org);
    }
    return groups;
}

// Calculate stats
function calculateStats(orgs) {
    const orgList = Object.values(orgs);
    return {
        total: orgList.length,
        byPriority: {
            unknown: orgList.filter(o => o.priority === 'unknown').length,
            low: orgList.filter(o => o.priority === 'low').length,
            medium: orgList.filter(o => o.priority === 'medium').length,
            high: orgList.filter(o => o.priority === 'high').length,
            critical: orgList.filter(o => o.priority === 'critical').length
        },
        byStage: {
            unknown: orgList.filter(o => o.relationshipStage === 'unknown').length,
            researching: orgList.filter(o => o.relationshipStage === 'researching').length,
            contacted: orgList.filter(o => o.relationshipStage === 'contacted').length,
            engaged: orgList.filter(o => o.relationshipStage === 'engaged').length,
            aligned: orgList.filter(o => o.relationshipStage === 'aligned').length,
            champion: orgList.filter(o => o.relationshipStage === 'champion').length
        },
        withNotes: orgList.filter(o => o.notes).length,
        contacted: orgList.filter(o => o.lastContacted).length,
        prioritized: orgList.filter(o => o.priority !== 'unknown').length
    };
}

// Debounce helper
function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Export
window.Utils = {
    PRIORITY_LEVELS,
    RELATIONSHIP_STAGES,
    ORG_TYPES,
    formatDate,
    formatRelativeTime,
    getPriorityScore,
    filterOrgs,
    sortOrgs,
    groupByCategory,
    calculateStats,
    debounce
};
