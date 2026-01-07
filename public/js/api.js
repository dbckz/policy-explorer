// Policy Orbit API Client

const API = {
    baseUrl: '/api',

    // Fetch all CRM data
    async getData() {
        const res = await fetch(`${this.baseUrl}/data`);
        if (!res.ok) throw new Error('Failed to load data');
        return res.json();
    },

    // Get single organization
    async getOrg(id) {
        const res = await fetch(`${this.baseUrl}/orgs/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('Organization not found');
        return res.json();
    },

    // Update organization
    async updateOrg(id, updates) {
        const res = await fetch(`${this.baseUrl}/orgs/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update organization');
        return res.json();
    },

    // Bulk update organizations
    async bulkUpdateOrgs(updates) {
        const res = await fetch(`${this.baseUrl}/orgs`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to bulk update');
        return res.json();
    },

    // Add custom tag
    async addTag(tag) {
        const res = await fetch(`${this.baseUrl}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag })
        });
        if (!res.ok) throw new Error('Failed to add tag');
        return res.json();
    },

    // Delete tag
    async deleteTag(tag) {
        const res = await fetch(`${this.baseUrl}/tags/${encodeURIComponent(tag)}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete tag');
        return res.json();
    },

    // Reset all data
    async resetData() {
        const res = await fetch(`${this.baseUrl}/reset`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to reset data');
        return res.json();
    },

    // Export data
    async exportData() {
        window.location.href = `${this.baseUrl}/export`;
    },

    // Import data
    async importData(data) {
        const res = await fetch(`${this.baseUrl}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to import data');
        return res.json();
    }
};

// Export for use
window.API = API;
