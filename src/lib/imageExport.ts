import { toPng } from 'html-to-image';
import { getNodesBounds, type Node } from '@xyflow/react';
import { downloadUrl } from './download';

const PADDING = 40;

export async function exportToPng(nodes: Node[], fileName: string): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) return;

  const bounds = getNodesBounds(nodes);
  const width = bounds.width + PADDING * 2;
  const height = bounds.height + PADDING * 2;

  // エッジの SVG は 300x150 のまま overflow: visible で描かれており、html-to-image では
  // はみ出した部分が切れてしまうため、書き出し中だけ全体を覆うサイズに広げる
  const svgs = [...viewport.querySelectorAll<SVGElement>('.react-flow__edges svg')];
  const saved = svgs.map((s) => [s.style.width, s.style.height] as const);
  svgs.forEach((s) => {
    s.style.width = `${bounds.x + bounds.width + PADDING}px`;
    s.style.height = `${bounds.y + bounds.height + PADDING}px`;
  });

  // 画面の表示位置・ズームに関係なく、全体を等倍で書き出す
  const dataUrl = await toPng(viewport, {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
  }).finally(() => {
    svgs.forEach((s, i) => { [s.style.width, s.style.height] = saved[i]; });
  });
  downloadUrl(dataUrl, fileName);
}
