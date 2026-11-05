import { useRef, useState } from 'react';
import { localDateKey } from '../lib/date';
import { useAppStore } from '../store/useAppStore';
import {
  buildBackup,
  buildBankExport,
  downloadJson,
  loadBackupData,
} from '../services/dataTransfer';
import { Modal } from './Modal';

type Tab = 'backup' | 'bank';

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('文件不是有效 JSON');
  }
}

export function DataPanel(): JSX.Element {
  const open = useAppStore((state) => state.dataOpen);
  const setOpen = useAppStore((state) => state.setDataOpen);
  const questions = useAppStore((state) => state.questions);
  const levels = useAppStore((state) => state.levels);
  const attempts = useAppStore((state) => state.attempts);
  const wrongItems = useAppStore((state) => state.wrongItems);
  const importBank = useAppStore((state) => state.importBank);
  const restore = useAppStore((state) => state.restore);
  const showToast = useAppStore((state) => state.showToast);

  const [tab, setTab] = useState<Tab>('backup');
  const [busy, setBusy] = useState(false);
  const [bankText, setBankText] = useState('');
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankFileName, setBankFileName] = useState('');
  const [restoreRaw, setRestoreRaw] = useState<unknown>(null);
  const [restoreName, setRestoreName] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    setBusy(true);
    try {
      const data = await loadBackupData();
      downloadJson(`gaoshu-backup-${localDateKey()}.json`, buildBackup(data));
      showToast('完整备份已导出');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出备份失败');
    } finally {
      setBusy(false);
    }
  };

  const handleExportBank = () => {
    downloadJson(
      `gaoshu-question-bank-${localDateKey()}.json`,
      buildBankExport(questions, levels),
    );
    showToast('题库 JSON 已导出');
  };

  const handleBankFile = async (file: File | undefined) => {
    if (!file) return;
    setBankFileName(file.name);
    setBankError(null);
    try {
      const text = await file.text();
      setBankText(text);
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== 'object' || parsed === null) throw new Error('文件根节点应为对象');
      const candidate = parsed as { questions?: unknown[]; levels?: unknown[] };
      if (!Array.isArray(candidate.questions) || !Array.isArray(candidate.levels)) {
        throw new Error('缺少 questions 或 levels 数组');
      }
      showToast(`已载入 ${candidate.questions.length} 题 / ${candidate.levels.length} 关，等待导入`);
    } catch (error) {
      setBankError(error instanceof Error ? error.message : '读取题库失败');
    }
  };

  const handleImportBank = async () => {
    setBankError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bankText) as unknown;
    } catch {
      setBankError('JSON 语法错误，无法解析');
      return;
    }
    setBusy(true);
    try {
      await importBank(parsed);
      setBankText('');
      setBankFileName('');
    } catch (error) {
      setBankError(error instanceof Error ? error.message : '题库导入失败');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    setRestoreName(file.name);
    setRestoreError(null);
    setRestoreRaw(null);
    try {
      const raw = await readJsonFile(file);
      setRestoreRaw(raw);
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '读取备份失败');
    }
  };

  const handleRestore = async () => {
    if (!restoreRaw) return;
    setBusy(true);
    try {
      await restore(restoreRaw);
      setRestoreRaw(null);
      setRestoreName('');
      setOpen(false);
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '恢复备份失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="数据与题库" onClose={() => setOpen(false)} wide>
      <div className="data-tabs" role="tablist">
        <button
          className={tab === 'backup' ? 'active' : ''}
          onClick={() => setTab('backup')}
          role="tab"
          aria-selected={tab === 'backup'}
        >
          备份与恢复
        </button>
        <button
          className={tab === 'bank' ? 'active' : ''}
          onClick={() => setTab('bank')}
          role="tab"
          aria-selected={tab === 'bank'}
        >
          导入题库
        </button>
      </div>

      {tab === 'backup' ? (
        <div className="data-panel">
          <div className="data-summary">
            <div>
              <strong>{questions.length}</strong>
              <span>题</span>
            </div>
            <div>
              <strong>{levels.length}</strong>
              <span>关</span>
            </div>
            <div>
              <strong>{attempts.length}</strong>
              <span>次尝试</span>
            </div>
            <div>
              <strong>{wrongItems.length}</strong>
              <span>错题</span>
            </div>
          </div>

          <section className="data-section">
            <div>
              <h3>导出完整备份</h3>
              <p>
                包含题库、关卡、所有尝试与作答、错题复习状态、段位档案和设置。
                文件只下载到本机，不会上传。
              </p>
            </div>
            <button className="button primary" onClick={handleExportBackup} disabled={busy}>
              导出备份 JSON
            </button>
          </section>

          <section className="data-section">
            <div>
              <h3>恢复备份</h3>
              <p className="danger-copy">
                恢复会<strong>覆盖当前浏览器中的全部进度</strong>。建议先导出一份当前备份。
              </p>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  void handleRestoreFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <button
                className="button ghost"
                onClick={() => restoreInputRef.current?.click()}
                disabled={busy}
              >
                选择备份文件
              </button>
              {restoreName ? <span className="file-name">{restoreName}</span> : null}
              {restoreError ? <div className="form-error">{restoreError}</div> : null}
              {restoreRaw ? (
                <div className="restore-confirm">
                  <span>文件已读取。确认覆盖当前全部数据？</span>
                  <button className="button danger small" onClick={handleRestore} disabled={busy}>
                    {busy ? '恢复中…' : '确认覆盖并恢复'}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="data-section">
            <div>
              <h3>导出题库</h3>
              <p>只导出 105 道题和 21 个关卡配置，便于修改后再导入；不包含个人进度。</p>
            </div>
            <button className="button ghost" onClick={handleExportBank}>
              导出题库 JSON
            </button>
          </section>

          <p className="data-footnote">
            本应用不设账号、不发起网络请求。清理浏览器站点数据会删除全部进度，请定期导出备份。
          </p>
        </div>
      ) : (
        <div className="data-panel">
          <section className="data-section bank-intro">
            <div>
              <h3>导入可扩展题库</h3>
              <p>
                文件格式为 <code>gaoshu-question-bank</code>，必须保持上册七章、每章 15 题、
                21 个关卡、每关 5 题，且每章覆盖选择 / 判断 / 解答与三档难度，Boss 关至少 2 道挑战题。
              </p>
              <p className="small-note">
                导入题库不会清空历史尝试和错题；旧记录使用题目快照展示。若已有进行中或待结算关卡，需先处理。
              </p>
            </div>
          </section>

          <div className="bank-actions">
            <input
              ref={bankInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                void handleBankFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <button className="button ghost" onClick={() => bankInputRef.current?.click()}>
              选择题库文件
            </button>
            <button className="button ghost" onClick={handleExportBank}>
              导出当前题库作模板
            </button>
            {bankFileName ? <span className="file-name">{bankFileName}</span> : null}
          </div>

          <label className="bank-editor-label" htmlFor="bank-json">
            或直接粘贴 JSON
          </label>
          <textarea
            id="bank-json"
            className="bank-editor"
            value={bankText}
            onChange={(event) => {
              setBankText(event.target.value);
              setBankError(null);
            }}
            placeholder={'{\n  "format": "gaoshu-question-bank",\n  "questions": [ ...105 题 ],\n  "levels": [ ...21 关 ]\n}'}
            rows={12}
            spellCheck={false}
          />
          {bankError ? <div className="form-error pre-wrap">{bankError}</div> : null}
          <div className="bank-footer">
            <span>当前内置：{questions.length} 题 / {levels.length} 关</span>
            <button
              className="button primary"
              onClick={handleImportBank}
              disabled={busy || !bankText.trim()}
            >
              {busy ? '校验并导入中…' : '校验并导入题库'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
