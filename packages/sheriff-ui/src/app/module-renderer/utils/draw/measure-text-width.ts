import { Text as KonvaText } from 'konva/lib/shapes/Text';

const measureNode = new KonvaText({});

export function measureTextWidth(text: string, fontSize: number): number {
  measureNode.text(text);
  measureNode.fontSize(fontSize);
  return measureNode.getTextWidth();
}


