/**
 * Connector types per spec: connectors are relationship objects that link nodes.
 * Geometry is derived—never store absolute coords as source of truth.
 */

/** Anchor relative to node bounds. */
export type ConnectorAnchor =
  | { type: "center" }
  | { type: "perimeter"; position: number }
  | { type: "side"; side: "top" | "right" | "bottom" | "left"; offset: number }
  | { type: "point"; x: number; y: number };

/** Endpoint attached to a node. */
export type AttachedEndpoint = {
  type: "attached";
  nodeId: string;
  anchor: ConnectorAnchor;
};

/** Free endpoint at fixed canvas position. */
export type FreeEndpoint = {
  type: "free";
  x: number;
  y: number;
};

export type ConnectorEndpoint = AttachedEndpoint | FreeEndpoint;

export type RoutingMode = "straight" | "orthogonal" | "curved";

export type ArrowheadType = "triangle" | "point" | "none";

export type ConnectorLabel = {
  text: string;
  position: number;
};
