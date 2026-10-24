import { useState } from 'react';
import type { FamilyTree } from './types';
import { storage } from './lib/storage';
import { HomeScreen } from './components/HomeScreen';
import { TreeEditor } from './components/TreeEditor';

export default function App() {
  const [trees, setTrees] = useState<FamilyTree[]>(() => storage.loadAll());
  const [current, setCurrent] = useState<FamilyTree | null>(null);

  const refresh = () => setTrees(storage.loadAll());

  if (current) {
    return (
      <TreeEditor
        key={current.id}
        tree={current}
        onBack={() => { setCurrent(null); refresh(); }}
      />
    );
  }

  return <HomeScreen trees={trees} onSelect={setCurrent} onRefresh={refresh} />;
}
