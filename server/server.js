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

// ⭐ 萬用 SQL 執行器：自動將欄位與數值封裝成物件，完全免疫欄位順序錯亂！
function execObjects(db, sql) {
  try {
    const res = db.exec(sql);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      cols.forEach((col, idx) => { obj[col] = row[idx]; });
      return obj;
    });
  } catch (err) {
    console.error(`SQL Error: ${err.message}`, sql);
    return [];
  }
}

// ─── POST /api/register (註冊) ───────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password, name, grade } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: '請填寫完整註冊資訊' });

  try {
    const db = getDB();
    const cleanUser = username.trim();
    const exist = execObjects(db, `SELECT * FROM users WHERE username = '${cleanUser}'`);
    if (exist.length > 0) return res.status(409).json({ error: '此學號已被註冊過囉，請點選上方切換到「現有帳號登入」！' });

    db.run(`INSERT INTO users (username, password, name, role, grade) VALUES (?, ?, ?, 'student', ?)`,
      [cleanUser, password.trim(), name.trim(), parseInt(grade, 10) || 2]
    );
    saveDB();
    const newUser = execObjects(db, `SELECT * FROM users WHERE username = '${cleanUser}'`)[0];
    res.status(201).json({ message: '註冊成功！已為您自動登入。', user: newUser });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/login (登入) ──────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請填寫學號與密碼' });

  try {
    const db = getDB();
    const users = execObjects(db, `SELECT * FROM users WHERE username = '${username.trim()}' AND password = '${password.trim()}'`);
    if (users.length === 0) return res.status(401).json({ error: '學號或密碼輸入錯誤，請重新確認！' });
    res.json({ message: '登入成功', user: users[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/checklist (檢核表與打勾進度) ─────────────────────────────────
app.get('/api/checklist', (req, res) => {
  const grade = parseInt(req.query.grade, 10);
  const userId = parseInt(req.query.userId, 10);
  if (grade !== 2 && grade !== 3) return res.status(400).json({ error: 'grade 必須為 2 或 3' });

  try {
    const db = getDB();
    const cleanUserId = isNaN(userId) ? 0 : userId;
    const sql = `
      SELECT c.*, COALESCE(up.is_completed, 0) AS is_completed
      FROM checklists c
      LEFT JOIN user_progress up ON c.id = up.task_id AND up.user_id = ${cleanUserId}
      WHERE c.target_grade = ${grade}
      ORDER BY c.is_required DESC, c.deadline ASC, c.id ASC
    `;
    const items = execObjects(db, sql).map(item => ({
      ...item,
      is_required: item.is_required === 1 || item.is_required === true || item.is_required === '1',
      is_completed: item.is_completed === 1 || item.is_completed === true || item.is_completed === '1'
    }));
    res.json({ grade, total: items.length, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/checklist/progress (進度保存) ─────────────────────────────
app.post('/api/checklist/progress', (req, res) => {
  const { user_id, task_id, is_completed } = req.body;
  if (!user_id || !task_id) return res.status(400).json({ error: '缺少參數' });

  try {
    const db = getDB();
    const uid = parseInt(user_id, 10);
    const tid = parseInt(task_id, 10);
    const status = is_completed ? 1 : 0;

    const exist = execObjects(db, `SELECT * FROM user_progress WHERE user_id = ${uid} AND task_id = ${tid}`);
    if (exist.length > 0) {
      db.run(`UPDATE user_progress SET is_completed = ${status} WHERE user_id = ${uid} AND task_id = ${tid}`);
    } else {
      db.run(`INSERT INTO user_progress (user_id, task_id, is_completed) VALUES (${uid}, ${tid}, ${status})`);
    }
    saveDB();
    res.json({ message: '進度寫入成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/checklist (管理員發布任務) ──────────────────────────────────
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

// ─── DELETE /api/checklist/:id (管理員刪除任務) ────────────────────────────
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
    const db = getDB();
    let sql = 'SELECT * FROM credit_records WHERE 1=1';
    if (status) sql += ` AND status = '${status}'`;
    if (q) sql += ` AND (original_school LIKE '%${q}%' OR original_dept LIKE '%${q}%' OR original_course LIKE '%${q}%' OR target_course LIKE '%${q}%')`;
    sql += ' ORDER BY created_at DESC';
    const records = execObjects(db, sql);
    res.json({ total: records.length, records });
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
    const record = execObjects(db, 'SELECT * FROM credit_records ORDER BY id DESC LIMIT 1')[0];
    res.status(201).json({ message: '新增成功', record });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 課程評價 API ──────────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  const dept = req.query.dept && req.query.dept !== 'all' && req.query.dept !== '全部學院' ? req.query.dept : '';
  try {
    const db = getDB();
    let sql = 'SELECT * FROM course_reviews WHERE 1=1';
    if (dept) sql += ` AND dept = '${dept}'`;
    if (q) sql += ` AND (course_name LIKE '%${q}%' OR teacher LIKE '%${q}%')`;
    sql += ' ORDER BY created_at DESC';
    const reviews = execObjects(db, sql);
    res.json({ total: reviews.length, reviews });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', (req, res) => {
  const { course_name, teacher, dept, semester, rating, difficulty, content, author } = req.body;
  if (!course_name || !teacher || !content) return res.status(400).json({ error: '缺少必填欄位' });
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run(
      `INSERT INTO course_reviews (course_name, teacher, dept, semester, rating, difficulty, content, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_name.trim(), teacher.trim(), dept || '資訊電機學院', semester || '113上', parseInt(rating,10)||5, parseInt(difficulty,10)||3, content.trim(), author?.trim() || '匿名學生', now]
    );
    saveDB();
    const review = execObjects(db, 'SELECT * FROM course_reviews ORDER BY id DESC LIMIT 1')[0];
    res.status(201).json({ message: '評價成功', review });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ 討論板與留言互動 API ───────────────────────────────────────────────────
app.get('/api/posts', (req, res) => {
  const cat = req.query.category && req.query.category !== 'all' && req.query.category !== '全部' ? req.query.category : '';
  try {
    const db = getDB();
    let sql = `
      SELECT p.*, COUNT(c.id) AS comments_count
      FROM posts p
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE 1=1
    `;
    if (cat) sql += ` AND p.category = '${cat}'`;
    sql += ` GROUP BY p.id ORDER BY p.created_at DESC`;
    const posts = execObjects(db, sql);
    res.json({ total: posts.length, posts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', (req, res) => {
  const { category, title, content, author } = req.body;
  if (!title || !content) return res.status(400).json({ error: '缺少標題或內容' });
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run(`INSERT INTO posts (category, title, content, author, likes, created_at) VALUES (?,?,?,?,0,?)`,
      [category || '一般閒聊', title.trim(), content.trim(), author?.trim() || '匿名島民', now]
    );
    saveDB();
    const post = execObjects(db, `SELECT p.*, 0 AS comments_count FROM posts p ORDER BY id DESC LIMIT 1`)[0];
    res.status(201).json({ message: '發文成功', post });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ 取得單篇文章的留言清單
app.get('/api/posts/:id/comments', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  try {
    const db = getDB();
    const comments = execObjects(db, `SELECT * FROM comments WHERE post_id = ${postId} ORDER BY id ASC`);
    res.json({ comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ 新增留言到單篇文章
app.post('/api/posts/:id/comments', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const { content, author } = req.body;
  if (!content) return res.status(400).json({ error: '留言內容不能為空' });
  try {
    const db = getDB(); const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    db.run(`INSERT INTO comments (post_id, content, author, created_at) VALUES (?,?,?,?)`,
      [postId, content.trim(), author?.trim() || '匿名島民', now]
    );
    saveDB();
    res.status(201).json({ message: '留言成功' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ 點讚單篇文章
app.post('/api/posts/:id/like', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  try {
    const db = getDB();
    db.run(`UPDATE posts SET likes = likes + 1 WHERE id = ${postId}`);
    saveDB();
    res.json({ message: '已按讚' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'public', 'index.html')); });

initDB().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`🚀 終極完全體 API 啟動於 port ${port}`));
}).catch(err => console.error(err));