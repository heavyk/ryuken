var Entity = require("./entity");

// We intentionally do not store source and target on the edge itself to
// make shallow graph cloning easier. This also prevents the edge from being
// rebased without the graph being aware of the change.
function Edge(graph, properties) {
  Entity.call(this, graph, properties);
}

Edge.prototype = Object.create(Entity.prototype);
Edge.prototype.constructor = Edge;
Edge.prototype.type = "edge";
Edge.prototype.edge = true;

Edge.prototype.source = function() {
  return this._source; // this.graph.getEdgeSource(this);
}

Edge.prototype.target = function() {
  return this._target; // this.graph.getEdgeTarget(this);
}

Edge.prototype.isSource = function(node) {
  return this.source() === node;
}

Edge.prototype.isTarget = function(node) {
  return this.target() === node;
}

Edge.prototype.rebase = function(source, target) {
  return this.graph.rebaseEdge(this, source, target);
}

// Returns the assigned edge weight or 1 if undefined.
//
// TODO: This approach violates the principle of least surprise.
// Might want to handle this on a case-by-case basis for each algorithm
// or set as default properties instead.
//
// TODO: Consider alternative graph.weight("prop") that can be used to set the
// property used for edge weights. This method would take that setting into
// account when determining edge weight.
Edge.prototype.weight = function(value) {
  if (arguments.length === 0) {
    return this.get("weight", 1);
  } else {
    return this.set("weight", value);
  }
}

// Returns the assigned edge multiplicity or 1 if undefined.
Edge.prototype.multiplicity = function(value) {
  if (arguments.length === 0) {
    return this.get("multiplicity", 1);
  } else {
    return this.set("multiplicity", value);
  }
}

module.exports = Edge;
