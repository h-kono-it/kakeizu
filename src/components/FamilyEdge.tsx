import { memo } from 'react';
import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import { UNION_SIZE } from '../lib/layout';

export type FamilyEdgeType = Edge<{ kind: 'partner' | 'child' }, 'family'>;

// 子の上に引く横線（兄弟で共有されるバス線）の高さ
const BUS_OFFSET = 18;

/**
 * 家系図らしい直角の線を描く。
 * - 配偶者 → 夫婦ノード: 真下に降りて、夫婦ノードの中心へ横から入る
 * - 夫婦ノード → 子: 子のすぐ上の高さで横に移動してから降りる
 */
export const FamilyEdge = memo(function FamilyEdge({ sourceX, sourceY, targetX, targetY, data, style }: EdgeProps<FamilyEdgeType>) {
  const path = data?.kind === 'partner'
    ? `M ${sourceX},${sourceY} V ${targetY + UNION_SIZE / 2} H ${targetX}`
    : `M ${sourceX},${sourceY} V ${targetY - BUS_OFFSET} H ${targetX} V ${targetY}`;
  return <BaseEdge path={path} style={style} />;
});
