import { useState, useRef } from 'react';
import type { FamilyTree, Person } from '../types';
import { storage } from '../lib/storage';
import { importFromJSON } from '../lib/transfer';

interface Props {
  trees: FamilyTree[];
  onSelect: (tree: FamilyTree) => void;
  onRefresh: () => void;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300';

export function HomeScreen({ trees, onSelect, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;
    try {
      const tree = await importFromJSON(file);
      if (trees.some((t) => t.id === tree.id) && !confirm(`「${tree.name}」はすでにあります。上書きしますか？`)) return;
      storage.save(tree);
      onRefresh();
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'インポートに失敗しました');
    }
  };

  const canCreate = newName.trim() && (familyName.trim() || givenName.trim());

  const handleCreate = () => {
    if (!canCreate) return;

    const first: Person = {
      id: crypto.randomUUID(),
      familyName: familyName.trim(),
      givenName: givenName.trim(),
      gender: 'unknown',
      deceased: false,
    };

    const tree: FamilyTree = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      persons: [first],
      unions: [],
      households: [],
      eraDisplay: 'western',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.save(tree);
    onRefresh();
    setCreating(false);
    setNewName('');
    setFamilyName('');
    setGivenName('');
    onSelect(tree);
  };

  const handleDelete = (tree: FamilyTree, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`「${tree.name}」を削除しますか？この操作は取り消せません。`)) return;
    storage.delete(tree.id);
    onRefresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">かんたん家系図</h1>
            <p className="text-sm text-gray-500 mt-1">クリックだけで家族のつながりを記録できます</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 mt-1 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            データを読み込む
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>

        {importError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 flex items-center justify-between">
            <span>{importError}</span>
            <button onClick={() => setImportError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
          入力した情報は、お使いのブラウザ（ローカルストレージ）にだけ保存されます。サーバーには一切送信されません。
          ブラウザのデータを削除すると家系図も消えるため、「データを書き出す」でバックアップを取っておくことをおすすめします。
        </div>

        {creating ? (
          <form
            className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm"
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          >
            <h2 className="text-base font-bold text-gray-700 mb-4">新しい家系図を作る</h2>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                家系図の名前 <span className="text-red-400">*</span>
              </label>
              <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例：山田家" autoFocus />
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              最初の人物（あなた自身など） <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <input className={inputCls} value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="姓" />
              <input className={inputCls} value={givenName} onChange={(e) => setGivenName(e.target.value)} placeholder="名" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!canCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                作成
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full mb-6 py-4 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
          >
            ＋ 新しい家系図を作る
          </button>
        )}

        <div className="space-y-2">
          {trees.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelect(t)}
              className="group flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{t.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {t.persons.length} 人 · 更新 {new Date(t.updatedAt).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(t, e)}
                className="text-xs text-gray-300 hover:text-red-500 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
