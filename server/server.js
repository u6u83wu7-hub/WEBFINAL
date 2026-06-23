import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, getDB, saveDB } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── POST /api/register (轉學生註冊新帳號) ─────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password, name, grade } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: '請填寫完整註冊資訊' });
  }

  try {
    const db = getDB();
    const cleanUser = username.trim();
    const check = db.exec(`SELECT 1 FROM users WHERE username = '${cleanUser}'`);
    if (check[0]) {
      return res.status(409).json({ error: '此學號已被註冊過囉，請點選上方切換到「現有帳號登入」！' });
    }

    const targetGrade = parseInt(grade, 10) || 2;
    db.run(
      `INSERT INTO users (username, password, name, role, grade) VALUES (?, ?, ?, 'student', ?)`,
      [cleanUser, password.trim(), name.trim(), targetGrade]
    );
    saveDB();

    const result = db.exec(`SELECT id, username, name, role, grade FROM users WHERE username = '${cleanUser}'`);
    const vals = result[0].values[0];
    const newUser = { id: vals[0], username: vals[1], name: vals[2], role: vals[3], grade: vals[4] };
    
    res.status(201).json({ message: '註冊成功！已為您自動登入。', user: newUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/login (驗證登入帳號密碼) ───────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請填寫學號與密碼' });

  try {
    const db = getDB();
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    const result = db.exec(`SELECT id, username, name, role, grade FROM users WHERE username = '${cleanUser}' AND password = '${cleanPass}'`);
    if (!result[0]) {
      return res.status(401).json({ error: '學號或密碼輸入錯誤，請重新確認！' });
    }
    const vals = result[0].values[0];
    const user = { id: vals[0], username: vals[1], name: vals[2], role: vals[3], grade: vals[4] };
    res.json({ message: '登入成功', user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/checklist (撈取清單與進度) ───────────────────────────────────
app.get('/api/checklist', (req, res) => {
  const grade = parseInt(req.query.grade, 10);
  const userId = parseInt(req.query.userId, 10);

  if (grade !== 2 && grade !== 3) return res.status(400).json({ error: 'grade 必須為 2 或 3' });

  try {
    const db = getDB();
    const cleanUserId = isNaN(userId) ? 0 : userId;
    let sql = `
      SELECT c.id, c.target_grade, c.category, c.text, c.is_required, c.deadline, c.building, c.office_phone,
             COALESCE(up.is_completed, 0) AS is_completed
      FROM checklists c
      LEFT JOIN user_progress up ON c.id = up.task_id AND up.user_id = ${cleanUserId}
      WHERE c.target_grade = ${grade}
      ORDER BY c.is_required DESC, c.deadline ASC, c.id ASC
    `;
    const result = db.exec(sql);
    const rows = result[0] ? result[0].values.map(v => ({
      id: v[0], target_grade: v[1], category: v[2], text: v[3], is_required: v[4] === 1,
      deadline: v[5], building: v[6], office_phone: v[7], is_completed: v[8] === 1
    })) : [];

    res.json({ grade, total: rows.length, items: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/checklist/progress (絕對寫入版進度儲存) ─────────────────────
app.post('/api/checklist/progress', (req, res) => {
  const { user_id, task_id, is_completed } = req.body;
  if (!user_id || !task_id) return res.status(400).json({ error: '缺少參數' });

  try {
    const db = getDB();
    const uid = parseInt(user_id, 10);
    const tid = parseInt(task_id, 10);
    const status = is_completed ? 1 : 0;

    const exist = db.exec(`SELECT 1 FROM user_progress WHERE user_id = ${uid} AND task_id = ${tid}`);
    if (exist[0]) {
      db.run(`UPDATE user_progress SET is_completed = ${status} WHERE user_id = ${uid} AND task_id = ${tid}`);
    } else {
      db.run(`INSERT INTO user_progress (user_id, task_id, is_completed) VALUES (${uid}, ${tid}, ${status})`);
    }
    saveDB();
    res.json({ message: '進度寫入成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/checklist (管理員發布任務) ────────────────────────────────────
app.post('/api/checklist', (req, res) => {
  const { target_grade, category, text, is_required, deadline, building, office_phone } = req.body;
  if (!target_grade || !category || !text || !deadline || !building) return res.status(400).json({ error: '請填寫完整資訊' });

  try {
    const db = getDB();
    db.run(
      `INSERT INTO checklists (target_grade, category, text, is_required, deadline, building, office_phone) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parseInt(target_grade, 10), category.trim(), text.trim(), is_required ? 1 : 0, deadline, building.trim(), office_phone ? office_phone.trim() : '分機2111']
    );
    saveDB();
    res.status(201).json({ message: '發布成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE /api/checklist/:id (管理員刪除任務) ──────────────────────────────
app.delete('/api/checklist/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID 錯誤' });

  try {
    const db = getDB();
    db.run(`DELETE FROM checklists WHERE id = ${id}`);
    db.run(`DELETE FROM user_progress WHERE task_id = ${id}`);
    saveDB();
    res.json({ message: '刪除成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 學分抵免 API ──────────────────────────────────────────────────────────
app.get('/api/credits', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  const status = req.query.status && req.query.status !== 'all' ? req.query.status : '';
  try {
    const db = getDB(); let sql = 'SELECT * FROM credit_records WHERE 1=1'; const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (q) {
      sql += ' AND (original_school LIKE ? OR original_dept LIKE ? OR original_course LIKE ? OR target_course LIKE ?)';
      const like = `%${q}%`; params.push(like, like, like, like);
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql); const rows = []; stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); res.json({ total: rows.length, records: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/credits', (req, res) => {
  const { original_school, original_dept, original_course, credits, target_course, status, advice } = req.body;
  if (!original_school || !original_dept || !original_course || !credits || !target_course || !status) return res.status(400).json({ error: '缺少必填欄位' });
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run(
      `INSERT INTO credit_records (original_school, original_dept, original_course, credits, target_course, status, advice, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [original_school.trim(), original_dept.trim(), original_course.trim(), parseInt(credits,10), target_course.trim(), status, advice ? advice.trim() : null, now]
    );
    saveDB();
    const r = db.exec('SELECT * FROM credit_records ORDER BY id DESC LIMIT 1');
    const cols = r[0].columns; const vals = r[0].values[0]; const rec = {};
    cols.forEach((c, i) => { rec[c] = vals[i]; });
    res.status(201).json({ message: '新增成功', record: rec });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 課程評價 API ──────────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : ''; const dept = req.query.dept && req.query.dept !== 'all' ? req.query.dept : '';
  try {
    const db = getDB(); let sql = 'SELECT * FROM course_reviews WHERE 1=1'; const params = [];
    if (q) { sql += ' AND (course_name LIKE ? OR teacher LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    if (dept) { sql += ' AND dept = ?'; params.push(dept); }
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql); const rows = []; stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); res.json({ total: rows.length, reviews: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', (req, res) => {
  const { course_name, teacher, dept, semester, rating, difficulty, content, author } = req.body;
  if (!course_name || !teacher || !dept || !semester || !rating || !difficulty || !content) return res.status(400).json({ error: '缺少必填欄位' });
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run(
      `INSERT INTO course_reviews (course_name, teacher, dept, semester, rating, difficulty, content, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_name.trim(), teacher.trim(), dept.trim(), semester.trim(), parseInt(rating,10), parseInt(difficulty,10), content.trim(), author?.trim() || '匿名學生', now]
    );
    saveDB(); res.status(201).json({ message: '評價成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 討論板 API ────────────────────────────────────────────────────────────
app.get('/api/posts', (req, res) => {
  const cat = req.query.category && req.query.category !== 'all' ? req.query.category : '';
  try {
    const db = getDB(); let sql = 'SELECT * FROM posts WHERE 1=1';
    if (cat) sql += ` AND category = '${cat}'`; sql += ' ORDER BY created_at DESC';
    const r = db.exec(sql);
    res.json({ posts: r[0] ? r[0].values.map(v=>({id:v[0],category:v[1],title:v[2],content:v[3],author:v[4],likes:v[5],created_at:v[6]})) : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', (req, res) => {
  const { category, title, content, author } = req.body;
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run('INSERT INTO posts (category,title,content,author,created_at) VALUES (?,?,?,?,?)', [category||'一般', title, content, author||'匿名學生', now]);
    saveDB(); res.status(201).json({ message: '發文成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'public', 'index.html')); });

initDB().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`🚀 旗艦版 API 啟動於 port ${port}`));
}).catch(err => console.error(err));