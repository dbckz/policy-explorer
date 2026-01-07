// UK AI & Data Policy Ecosystem - Interactive Network Graph
// Built with D3.js v7

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        nodeRadius: {
            root: 35,
            main_category: 28,
            category: 22,
            subcategory: 16,
            entity: 10
        },
        colors: {
            root: '#e74c3c',
            main_category: '#9b59b6',
            category: '#3498db',
            subcategory: '#2ecc71',
            entity: '#f39c12'
        },
        typeLabels: {
            root: 'Root',
            main_category: 'Main Category',
            category: 'Category',
            subcategory: 'Subcategory',
            entity: 'Entity'
        },
        simulation: {
            chargeStrength: -400,
            linkDistance: 80,
            collisionRadius: 1.5
        }
    };

    // State
    let state = {
        data: null,
        nodes: [],
        links: [],
        expandedNodes: new Set(),
        currentFilter: 'all',
        searchTerm: '',
        highlightedNodeId: null,
        totalNodeCount: 0
    };

    // D3 Elements
    let svg, g, simulation, linkGroup, nodeGroup, zoom;
    let width, height;

    // Initialize the application
    async function init() {
        try {
            await loadData();
            setupSVG();
            setupSimulation();
            setupControls();
            setupLegend();
            initializeExpandedState();
            updateGraph();
            updateStats();
        } catch (error) {
            showError(error.message);
            console.error('Initialization error:', error);
        }
    }

    // Load JSON data
    async function loadData() {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('Failed to load ecosystem data');
        }
        state.data = await response.json();
        state.totalNodeCount = countAllNodes(state.data);
    }

    // Count all nodes recursively
    function countAllNodes(node) {
        let count = 1;
        if (node.children) {
            node.children.forEach(child => {
                count += countAllNodes(child);
            });
        }
        return count;
    }

    // Setup SVG canvas
    function setupSVG() {
        const container = document.getElementById('graph-container');
        width = container.clientWidth;
        height = container.clientHeight;

        svg = d3.select('#graph')
            .attr('width', width)
            .attr('height', height);

        // Clear any existing content
        svg.selectAll('*').remove();

        // Setup zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                updateZoomLevel(event.transform.k);
            });

        svg.call(zoom);

        // Create main group for graph elements
        g = svg.append('g');

        // Create groups for links and nodes (order matters for z-index)
        linkGroup = g.append('g').attr('class', 'links');
        nodeGroup = g.append('g').attr('class', 'nodes');

        // Handle window resize
        window.addEventListener('resize', handleResize);
    }

    // Setup force simulation
    function setupSimulation() {
        simulation = d3.forceSimulation()
            .force('link', d3.forceLink()
                .id(d => d.id)
                .distance(d => CONFIG.simulation.linkDistance))
            .force('charge', d3.forceManyBody()
                .strength(CONFIG.simulation.chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide()
                .radius(d => CONFIG.nodeRadius[d.type] * CONFIG.simulation.collisionRadius))
            .on('tick', ticked);
    }

    // Initialize expanded state - only root and main categories visible
    function initializeExpandedState() {
        state.expandedNodes.clear();
        // Expand only the root node
        state.expandedNodes.add(generateNodeId(state.data));
    }

    // Generate unique node ID
    function generateNodeId(node, parentId = '') {
        return parentId ? `${parentId}/${node.name}` : node.name;
    }

    // Build nodes and links from hierarchical data
    function buildGraph() {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        function traverse(node, parent = null, parentId = '') {
            const nodeId = generateNodeId(node, parentId);

            // Check if this node should be visible based on filter
            if (!shouldShowNode(node, parentId)) {
                return;
            }

            // Check if parent is expanded (or this is root)
            if (parent !== null && !state.expandedNodes.has(parentId)) {
                return;
            }

            const graphNode = {
                id: nodeId,
                name: node.name,
                type: node.type,
                hasChildren: !!(node.children && node.children.length > 0),
                childCount: node.children ? node.children.length : 0,
                isExpanded: state.expandedNodes.has(nodeId),
                originalData: node,
                parentId: parentId
            };

            nodes.push(graphNode);
            nodeMap.set(nodeId, graphNode);

            if (parent !== null) {
                links.push({
                    source: parentId,
                    target: nodeId
                });
            }

            // Traverse children if expanded
            if (node.children && state.expandedNodes.has(nodeId)) {
                node.children.forEach(child => {
                    traverse(child, node, nodeId);
                });
            }
        }

        traverse(state.data);

        // Filter links to only include those where both nodes exist
        const validLinks = links.filter(link =>
            nodeMap.has(link.source) && nodeMap.has(link.target)
        );

        return { nodes, links: validLinks };
    }

    // Check if node should be shown based on filter
    function shouldShowNode(node, parentId) {
        if (state.currentFilter === 'all') return true;

        // Root always visible
        if (node.type === 'root') return true;

        // Determine which main category this node belongs to
        const isGovernment = parentId.includes('Government') || node.name === 'Government';
        const isExternal = parentId.includes('Think Tanks') || node.name.includes('Think Tanks');

        if (state.currentFilter === 'government') {
            return node.name === 'Government' || isGovernment;
        }
        if (state.currentFilter === 'external') {
            return node.name.includes('Think Tanks') || isExternal;
        }

        return true;
    }

    // Update the graph visualization
    function updateGraph() {
        const graph = buildGraph();
        state.nodes = graph.nodes;
        state.links = graph.links;

        // Update links
        const link = linkGroup.selectAll('.link')
            .data(state.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

        link.exit()
            .transition()
            .duration(300)
            .style('opacity', 0)
            .remove();

        const linkEnter = link.enter()
            .append('line')
            .attr('class', 'link')
            .style('opacity', 0);

        linkEnter.transition()
            .duration(300)
            .style('opacity', 1);

        const allLinks = linkEnter.merge(link);

        // Update nodes
        const node = nodeGroup.selectAll('.node')
            .data(state.nodes, d => d.id);

        node.exit()
            .transition()
            .duration(300)
            .style('opacity', 0)
            .attr('transform', d => `translate(${width / 2}, ${height / 2})`)
            .remove();

        const nodeEnter = node.enter()
            .append('g')
            .attr('class', d => `node ${d.hasChildren && !d.isExpanded ? 'collapsed' : ''}`)
            .style('opacity', 0)
            .call(d3.drag()
                .on('start', dragStarted)
                .on('drag', dragged)
                .on('end', dragEnded))
            .on('click', handleNodeClick)
            .on('mouseenter', handleNodeHover)
            .on('mouseleave', handleNodeLeave);

        nodeEnter.append('circle')
            .attr('r', d => CONFIG.nodeRadius[d.type])
            .attr('fill', d => CONFIG.colors[d.type])
            .attr('stroke', d => d3.color(CONFIG.colors[d.type]).darker(0.5));

        // Add expand/collapse indicator
        nodeEnter.append('text')
            .attr('class', 'node-indicator')
            .attr('dy', '0.1em')
            .text(d => {
                if (!d.hasChildren) return '';
                return d.isExpanded ? '−' : '+';
            });

        // Add label
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', d => CONFIG.nodeRadius[d.type] + 14)
            .attr('text-anchor', 'middle')
            .text(d => truncateLabel(d.name, d.type));

        nodeEnter.transition()
            .duration(300)
            .style('opacity', 1);

        const allNodes = nodeEnter.merge(node);

        // Update existing nodes
        allNodes.select('circle')
            .attr('r', d => CONFIG.nodeRadius[d.type])
            .attr('fill', d => CONFIG.colors[d.type])
            .attr('stroke', d => d3.color(CONFIG.colors[d.type]).darker(0.5));

        allNodes.select('.node-indicator')
            .text(d => {
                if (!d.hasChildren) return '';
                return d.isExpanded ? '−' : '+';
            });

        allNodes.select('.node-label')
            .text(d => truncateLabel(d.name, d.type));

        allNodes.attr('class', d => {
            let classes = 'node';
            if (d.hasChildren && !d.isExpanded) classes += ' collapsed';
            if (state.highlightedNodeId === d.id) classes += ' highlighted';
            return classes;
        });

        // Update simulation
        simulation.nodes(state.nodes);
        simulation.force('link').links(state.links);
        simulation.alpha(0.5).restart();

        updateStats();
        updateHighlighting();
    }

    // Truncate label for display
    function truncateLabel(name, type) {
        const maxLength = type === 'entity' ? 15 : type === 'subcategory' ? 20 : 25;
        if (name.length > maxLength) {
            return name.substring(0, maxLength - 2) + '...';
        }
        return name;
    }

    // Simulation tick
    function ticked() {
        linkGroup.selectAll('.link')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        nodeGroup.selectAll('.node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    // Drag handlers
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Handle node click - toggle expand/collapse
    function handleNodeClick(event, d) {
        event.stopPropagation();

        if (!d.hasChildren) return;

        if (state.expandedNodes.has(d.id)) {
            // Collapse - also collapse all descendants
            collapseNode(d.id);
        } else {
            // Expand
            state.expandedNodes.add(d.id);
        }

        updateGraph();
    }

    // Collapse a node and all its descendants
    function collapseNode(nodeId) {
        state.expandedNodes.delete(nodeId);

        // Find and collapse all descendants
        state.nodes.forEach(node => {
            if (node.parentId && node.parentId.startsWith(nodeId)) {
                state.expandedNodes.delete(node.id);
            }
        });
    }

    // Handle node hover
    function handleNodeHover(event, d) {
        showTooltip(event, d);
        highlightConnected(d);
    }

    // Handle node leave
    function handleNodeLeave() {
        hideTooltip();
        clearHighlighting();
    }

    // Show tooltip
    function showTooltip(event, d) {
        const tooltip = document.getElementById('tooltip');
        tooltip.querySelector('.tooltip-title').textContent = d.name;
        tooltip.querySelector('.tooltip-type').textContent = CONFIG.typeLabels[d.type];

        const childrenText = d.hasChildren ?
            `${d.childCount} ${d.childCount === 1 ? 'child' : 'children'}${d.isExpanded ? ' (expanded)' : ' (collapsed)'}` :
            'No children';
        tooltip.querySelector('.tooltip-children').textContent = childrenText;

        tooltip.classList.remove('hidden');

        // Position tooltip
        const x = event.pageX + 15;
        const y = event.pageY + 15;

        tooltip.style.left = `${Math.min(x, window.innerWidth - 300)}px`;
        tooltip.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    }

    // Hide tooltip
    function hideTooltip() {
        document.getElementById('tooltip').classList.add('hidden');
    }

    // Highlight connected nodes
    function highlightConnected(d) {
        const connectedIds = new Set([d.id]);

        // Find directly connected nodes
        state.links.forEach(link => {
            const sourceId = link.source.id || link.source;
            const targetId = link.target.id || link.target;
            if (sourceId === d.id) connectedIds.add(targetId);
            if (targetId === d.id) connectedIds.add(sourceId);
        });

        nodeGroup.selectAll('.node')
            .classed('dimmed', n => !connectedIds.has(n.id));

        linkGroup.selectAll('.link')
            .classed('highlighted', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return sourceId === d.id || targetId === d.id;
            })
            .classed('dimmed', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return sourceId !== d.id && targetId !== d.id;
            });
    }

    // Clear highlighting
    function clearHighlighting() {
        nodeGroup.selectAll('.node').classed('dimmed', false);
        linkGroup.selectAll('.link')
            .classed('highlighted', false)
            .classed('dimmed', false);
    }

    // Update highlighting based on search
    function updateHighlighting() {
        if (!state.highlightedNodeId) return;

        nodeGroup.selectAll('.node')
            .classed('highlighted', d => d.id === state.highlightedNodeId);
    }

    // Setup control event handlers
    function setupControls() {
        // Search
        const searchInput = document.getElementById('search');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value.toLowerCase();
            updateSearchResults();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentFilter = btn.dataset.filter;
                updateGraph();
            });
        });

        // Expand all
        document.getElementById('expand-all').addEventListener('click', expandAll);

        // Collapse all
        document.getElementById('collapse-all').addEventListener('click', collapseAll);

        // Reset view
        document.getElementById('reset-view').addEventListener('click', resetView);

        // Fit to screen
        document.getElementById('fit-screen').addEventListener('click', fitToScreen);

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1.3);
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 0.7);
        });
    }

    // Update search results
    function updateSearchResults() {
        const searchResults = document.getElementById('search-results');
        searchResults.innerHTML = '';

        if (state.searchTerm.length < 2) {
            searchResults.classList.remove('show');
            state.highlightedNodeId = null;
            updateGraph();
            return;
        }

        const matches = findMatchingNodes(state.data, state.searchTerm);

        if (matches.length === 0) {
            searchResults.classList.remove('show');
            return;
        }

        searchResults.classList.add('show');

        matches.slice(0, 10).forEach(match => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = match.name;
            item.addEventListener('click', () => {
                focusOnNode(match);
                document.getElementById('search').value = match.name;
                searchResults.classList.remove('show');
            });
            searchResults.appendChild(item);
        });
    }

    // Find matching nodes in hierarchy
    function findMatchingNodes(node, term, path = [], results = []) {
        const currentPath = [...path, node.name];

        if (node.name.toLowerCase().includes(term)) {
            results.push({
                ...node,
                path: currentPath
            });
        }

        if (node.children) {
            node.children.forEach(child => {
                findMatchingNodes(child, term, currentPath, results);
            });
        }

        return results;
    }

    // Focus on a specific node
    function focusOnNode(matchedNode) {
        // Expand path to node
        let currentId = '';
        const path = matchedNode.path;

        for (let i = 0; i < path.length - 1; i++) {
            currentId = currentId ? `${currentId}/${path[i]}` : path[i];
            state.expandedNodes.add(currentId);
        }

        const targetId = path.join('/');
        state.highlightedNodeId = targetId;

        updateGraph();

        // Wait for simulation to settle, then center on node
        setTimeout(() => {
            const targetNode = state.nodes.find(n => n.id === targetId);
            if (targetNode) {
                centerOnNode(targetNode);
            }
        }, 500);
    }

    // Center view on a node
    function centerOnNode(node) {
        const scale = 1.5;
        const x = width / 2 - node.x * scale;
        const y = height / 2 - node.y * scale;

        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }

    // Expand all nodes
    function expandAll() {
        function expandRecursive(node, parentId = '') {
            const nodeId = generateNodeId(node, parentId);
            if (node.children) {
                state.expandedNodes.add(nodeId);
                node.children.forEach(child => {
                    expandRecursive(child, nodeId);
                });
            }
        }
        expandRecursive(state.data);
        updateGraph();
    }

    // Collapse all nodes
    function collapseAll() {
        state.expandedNodes.clear();
        state.expandedNodes.add(generateNodeId(state.data));
        updateGraph();
    }

    // Reset view to initial state
    function resetView() {
        initializeExpandedState();
        state.highlightedNodeId = null;
        state.currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });
        document.getElementById('search').value = '';
        document.getElementById('search-results').classList.remove('show');

        updateGraph();

        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity);
    }

    // Fit graph to screen
    function fitToScreen() {
        if (state.nodes.length === 0) return;

        const bounds = {
            minX: d3.min(state.nodes, d => d.x) - 50,
            maxX: d3.max(state.nodes, d => d.x) + 50,
            minY: d3.min(state.nodes, d => d.y) - 50,
            maxY: d3.max(state.nodes, d => d.y) + 50
        };

        const graphWidth = bounds.maxX - bounds.minX;
        const graphHeight = bounds.maxY - bounds.minY;

        const scale = Math.min(
            width / graphWidth,
            height / graphHeight,
            2
        ) * 0.9;

        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        const x = width / 2 - centerX * scale;
        const y = height / 2 - centerY * scale;

        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }

    // Setup legend
    function setupLegend() {
        const legend = document.getElementById('legend');
        legend.innerHTML = '';

        Object.entries(CONFIG.typeLabels).forEach(([type, label]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${CONFIG.colors[type]}"></div>
                <span>${label}</span>
            `;
            legend.appendChild(item);
        });
    }

    // Update stats display
    function updateStats() {
        document.getElementById('visible-count').textContent = state.nodes.length;
        document.getElementById('total-count').textContent = state.totalNodeCount;
    }

    // Update zoom level display
    function updateZoomLevel(scale) {
        document.getElementById('zoom-level').textContent = `${Math.round(scale * 100)}%`;
    }

    // Handle window resize
    function handleResize() {
        const container = document.getElementById('graph-container');
        width = container.clientWidth;
        height = container.clientHeight;

        svg.attr('width', width).attr('height', height);

        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }

    // Show error message
    function showError(message) {
        const container = document.getElementById('graph-container');
        container.innerHTML = `
            <div class="error">
                <h2>Error Loading Data</h2>
                <p>${message}</p>
                <p>Please ensure ecosystem-data.json exists in the same directory.</p>
            </div>
        `;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
