import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { UNION_SIZE } from '../lib/layout';

export type UnionNodePayload = {
  divorced: boolean;
  hasPartners: boolean;
};

export type UnionNodeType = Node<UnionNodePayload, 'union'>;

const hiddenHandle = '!w-1 !h-1 !min-w-0 !min-h-0 !bg-transparent !border-0';

export const UnionNode = memo(function UnionNode({ data }: NodeProps<UnionNodeType>) {
  return (
    <>
      <Handle type="target" position={Position.Top} className={hiddenHandle} />
      <div
        style={{ width: UNION_SIZE, height: UNION_SIZE }}
        title={data.hasPartners ? 'クリックで関係を編集' : '親不明'}
        className={`rounded-full border-2 transition-transform ${
          data.hasPartners ? 'cursor-pointer hover:scale-125' : ''
        } ${data.divorced ? 'bg-white border-gray-400 border-dashed' : 'bg-gray-400 border-gray-400'}`}
      />
      <Handle type="source" position={Position.Bottom} className={hiddenHandle} />
    </>
  );
});
