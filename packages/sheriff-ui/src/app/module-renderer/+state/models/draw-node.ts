import type { RectConfig } from 'konva/lib/shapes/Rect';
import type { TextConfig } from 'konva/lib/shapes/Text';
import type { CircleConfig } from 'konva/lib/shapes/Circle';
import type { LineConfig } from 'konva/lib/shapes/Line';
import type { TagEntry } from '../../utils/draw/build-tags';

export class DrawNode {
  id: string;
  rect: RectConfig;
  title: TextConfig;
  titleSeparator?: LineConfig;
  borderTop?: LineConfig;
  tags: TagEntry[];
  toggle: { circle: CircleConfig; horiz: LineConfig; vert?: LineConfig } | null;

  constructor(init: {
    id: string;
    rect: RectConfig;
    title: TextConfig;
    titleSeparator?: LineConfig;
    borderTop?: LineConfig;
    tags: TagEntry[];
    toggle: { circle: CircleConfig; horiz: LineConfig; vert?: LineConfig } | null;
  }) {
    this.id = init.id;
    this.rect = init.rect;
    this.title = init.title;
    this.titleSeparator = init.titleSeparator;
    this.borderTop = init.borderTop;
    this.tags = init.tags;
    this.toggle = init.toggle;
  }
}


