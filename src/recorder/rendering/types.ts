export type StrokePoint = { x: number; y: number };

export type AnnotationStroke = {
  points: StrokePoint[];
  color: string;
  width: number;
  highlighter?: boolean;
};

export type AnnotationText = {
  x: number;
  y: number;
  text: string;
  color: string;
  fontPx: number;
};

export type AnnotationArrow = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

export type AnnotationShape = {
  kind: "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
  fill: boolean;
};

export type CompositorVisualState = {
  spotlight: boolean;
  spotlightRadius: number;
  cursorRing: boolean;
  clickPulses: Array<{ x: number; y: number; start: number }>;
  zoom: number;
  panNx: number;
  panNy: number;
  pipCxN: number;
  pipCyN: number;
  strokes: AnnotationStroke[];
  texts: AnnotationText[];
  arrows: AnnotationArrow[];
  shapes: AnnotationShape[];
};

export function createDefaultVisualState(): CompositorVisualState {
  return {
    spotlight: false,
    spotlightRadius: 0.22,
    cursorRing: true,
    clickPulses: [],
    zoom: 1,
    panNx: 0,
    panNy: 0,
    pipCxN: -1,
    pipCyN: -1,
    strokes: [],
    texts: [],
    arrows: [],
    shapes: [],
  };
}
