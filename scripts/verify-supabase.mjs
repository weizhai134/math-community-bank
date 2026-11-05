/**
 * 真实 Supabase 验收脚本（在能访问 supabase.co 的网络里运行）。
 *
 * 覆盖：
 *  - 匿名登录（A/B/C/D 四个独立匿名用户）
 *  - A 上传后 B 可见（双设备）
 *  - 未登录 anon 只能读 visible
 *  - 伪造 author_id 被 RLS 拒绝
 *  - B 删除 A 的题无效
 *  - 同一用户重复举报被唯一约束拒绝
 *  - B/C/D 三次举报后题目 hidden，普通列表与直查都读不到
 *  - A 删除自己的题成功后所有人读不到
 *
 * 用法：
 *   node scripts/verify-supabase.mjs
 * 或在 package.json 里：
 *   npm run verify:supabase
 *
 * 会写入测试数据；成功路径会自动删除测试题。测试匿名用户会留在项目里。
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    return {
      url: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_ANON_KEY,
    };
  }
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const get = (name) => {
      const line = text.split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`));
      return line ? line.slice(line.indexOf('=') + 1).trim() : '';
    };
    return { url: get('VITE_SUPABASE_URL'), key: get('VITE_SUPABASE_ANON_KEY') };
  } catch {
    return { url: '', key: '' };
  }
}

const { url, key } = loadEnv();
if (!url || !key) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（.env.local 或环境变量）');
  process.exit(2);
}

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'gaoshu-verify-script' } },
  });
}

async function anonymous(label) {
  const client = makeClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`${label} 匿名登录失败：${error.message}`);
  if (!data.user || !data.session) throw new Error(`${label} 匿名登录没有返回 session`);
  return { label, client, user: data.user, session: data.session };
}

async function main() {
  console.log(`项目：${url}`);
  console.log('开始真实验收（会写入一条测试题，结束后删除）...\n');

  const A = await anonymous('A');
  const B = await anonymous('B');
  const C = await anonymous('C');
  const D = await anonymous('D');
  check('匿名登录创建 4 个用户', true, A.user.id.slice(0, 8) + '…');
  check('匿名用户的 is_anonymous=true', A.user.is_anonymous === true);

  const unauth = makeClient();
  const stamp = Date.now();
  const payload = {
    chapter: 1,
    topic: '验收测试',
    difficulty: '基础',
    type: 'judge',
    stem: `真实验收测试题 ${stamp}：若 f 在 x0 连续，则 f 在 x0 可导。`,
    options: null,
    answer: false,
    explanation: '真实验收用解析：连续性不蕴含可导性。',
    source: '原创',
    nickname: '验收机器人',
    author_id: A.user.id,
    status: 'visible',
    content_hash: `verify-${stamp}`,
  };

  let questionId = null;
  const inserted = await A.client.from('community_questions').insert(payload).select('*').single();
  if (inserted.error) {
    check('A 上传社区题', false, inserted.error.message);
  } else {
    questionId = inserted.data.id;
    check('A 上传社区题', true, `id=${questionId}, status=${inserted.data.status}`);
  }

  if (questionId) {
    const visibleForAnon = await unauth
      .from('community_questions')
      .select('id,status')
      .eq('id', questionId);
    check(
      '未登录 anon 能读到 visible',
      !visibleForAnon.error && (visibleForAnon.data ?? []).length === 1,
      visibleForAnon.error?.message ?? `rows=${(visibleForAnon.data ?? []).length}`,
    );

    const visibleForB = await B.client
      .from('community_questions')
      .select('id,author_id')
      .eq('id', questionId);
    check(
      'B（另一设备/匿名用户）能看到 A 的题',
      !visibleForB.error && (visibleForB.data ?? []).length === 1,
      visibleForB.error?.message ?? `rows=${(visibleForB.data ?? []).length}`,
    );

    const forged = await A.client
      .from('community_questions')
      .insert({ ...payload, author_id: B.user.id, content_hash: `forge-${stamp}` })
      .select('id');
    check('伪造 author_id 被拒绝', Boolean(forged.error), forged.error?.code ?? 'no error');

    const deleteByB = await B.client
      .from('community_questions')
      .delete()
      .eq('id', questionId)
      .select('id');
    const stillThere = await A.client
      .from('community_questions')
      .select('id')
      .eq('id', questionId);
    check(
      'B 不能删除 A 的题',
      !deleteByB.error && (deleteByB.data ?? []).length === 0 && (stillThere.data ?? []).length === 1,
      deleteByB.error?.message ?? `deleted=${(deleteByB.data ?? []).length}`,
    );

    const report1 = await B.client
      .from('community_reports')
      .insert({ question_id: questionId, reporter_id: B.user.id });
    const reportAgain = await B.client
      .from('community_reports')
      .insert({ question_id: questionId, reporter_id: B.user.id });
    check('同一用户重复举报被唯一约束拒绝', Boolean(reportAgain.error), reportAgain.error?.code ?? 'no error');

    await C.client.from('community_reports').insert({ question_id: questionId, reporter_id: C.user.id });
    await D.client.from('community_reports').insert({ question_id: questionId, reporter_id: D.user.id });
    await sleep(500);

    const afterReports = await A.client
      .from('community_questions')
      .select('id,status,report_count')
      .eq('id', questionId);
    check(
      '3 次举报后题目 hidden（作者也读不到）',
      !afterReports.error && (afterReports.data ?? []).length === 0,
      afterReports.error?.message ?? `rows=${(afterReports.data ?? []).length}`,
    );

    const hiddenForAnon = await unauth
      .from('community_questions')
      .select('id')
      .eq('id', questionId);
    check(
      '隐藏题不再出现在普通列表',
      !hiddenForAnon.error && (hiddenForAnon.data ?? []).length === 0,
      hiddenForAnon.error?.message ?? `rows=${(hiddenForAnon.data ?? []).length}`,
    );

    const deleteByA = await A.client
      .from('community_questions')
      .delete()
      .eq('id', questionId)
      .select('id');
    check(
      'A 删除自己的题成功',
      !deleteByA.error && (deleteByA.data ?? []).length === 1,
      deleteByA.error?.message ?? `deleted=${(deleteByA.data ?? []).length}`,
    );
    const gone = await unauth.from('community_questions').select('id').eq('id', questionId);
    check('删除后所有人读不到', !gone.error && (gone.data ?? []).length === 0);
  }

  console.log(results.join('\n'));
  console.log(`\nTOTAL=${results.length} FAILURES=${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('验收中断：', error instanceof Error ? error.message : error);
  console.error('如果是 ECONNRESET / fetch failed，请确认当前网络能访问 supabase.co。');
  process.exit(2);
});
