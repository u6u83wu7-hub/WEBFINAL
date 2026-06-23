import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'transfer.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('✅ 讀取已存在的 SQLite 資料庫：', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✅ 建立全新的 SQLite 資料庫');
  }
  db.run('PRAGMA journal_mode = WAL;');

  // 1. 任務總表
  db.run(`
    CREATE TABLE IF NOT EXISTS checklists (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      target_grade INTEGER NOT NULL,
      category     TEXT    NOT NULL,
      text         TEXT    NOT NULL,
      is_required  INTEGER NOT NULL DEFAULT 1,
      deadline     TEXT    NOT NULL DEFAULT '2025-09-30',
      building     TEXT    NOT NULL DEFAULT '行政大樓',
      office_phone TEXT    NOT NULL DEFAULT '分機2111'
    )
  `);

  // ⭐ 2. 全新：使用者帳號表 (分拆 student 與 admin)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT    UNIQUE NOT NULL,
      password TEXT    NOT NULL,
      name     TEXT    NOT NULL,
      role     TEXT    NOT NULL DEFAULT 'student',
      grade    INTEGER DEFAULT 2
    )
  `);

  // ⭐ 3. 全新：使用者進度追蹤表 (複合主鍵綁死 UserID 與 TaskID)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id      INTEGER NOT NULL,
      task_id      INTEGER NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, task_id)
    )
  `);

  // 預設學分表
  db.run(`
    CREATE TABLE IF NOT EXISTS credit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, original_school TEXT NOT NULL, original_dept TEXT NOT NULL,
      original_course TEXT NOT NULL, credits INTEGER NOT NULL, target_course TEXT NOT NULL,
      status TEXT NOT NULL, advice TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // 寫入預設帳號假資料
  const userCnt = db.exec('SELECT COUNT(*) FROM users')[0]?.values[0][0] ?? 0;
  if (userCnt === 0) {
    const defaultUsers = [
      ['admin', 'admin123', '註冊課務組 ‧ 王管理員', 'admin', 0],
      ['d1140001', 'fcu1234', '大二轉學生 ‧ 林小明', 'student', 2],
      ['d1140002', 'fcu1234', '大三轉學生 ‧ 張小華', 'student', 3],
    ];
    defaultUsers.forEach(([u, p, n, r, g]) => {
      db.run('INSERT INTO users (username, password, name, role, grade) VALUES (?, ?, ?, ?, ?)', [u, p, n, r, g]);
    });
    console.log('✅ 系統預設登入帳號初始化完成');
  }

  // 寫入逢甲官方轉學任務假資料
  const chkCnt = db.exec('SELECT COUNT(*) FROM checklists')[0]?.values[0][0] ?? 0;
  if (chkCnt === 0) {
    const checklistData = [
      [2, '兵役與證件', '於育樂館現場辦理正取生報到，繳交國民身分證正本(驗後發還)、學歷證書正本及成績單。', 1, '2025-08-05', '育樂館', '分機2124'],
      [2, '帳號申請', '至新生專區啟用網路帳號(NID)，並登入 MyFCU 上傳證件照以製作逢甲正式學生證。', 1, '2025-08-07', '資訊電機館', '分機2708'],
      [2, '帳號申請', '登入 MyFCU ->「銀行帳號維護」，上傳學生本人金融機構存摺封面影本，供校內各項助學金與退費撥款使用。', 1, '2025-08-07', '行政大樓', '分機2361'],
      [2, '兵役與證件', '轉學男生務必登入 MyFCU 線上填寫「役男兵役狀況調查表」，詳填鄰里住址並送出，始能辦理緩徵儘召。', 1, '2025-08-06', '行政二館', '分機2225'],
      [2, '兵役與證件', '透過「行動逢甲APP」產生繳費單繳交上學期學雜費，可於超商、ATM轉帳或信用卡繳納。', 1, '2025-08-15', '行政大樓', '分機2056'],
      [2, '書卷與助學金', '確認行政院減免學雜費(1.75萬)資格；若大一階段曾請領過同等補助，請主動繳交具結書辦理切結。', 1, '2025-08-05', '行政二館', '分機2220'],
      [2, '學分抵免', '備妥成績單正本與各科課程大綱，進入註冊課務組「學分抵免專區」下載抵免單辦理，期限內務必完成。', 1, '2025-09-12', '資訊電機館', '分機2111'],
      [2, '健康檢查', '至衛保組網頁填寫問卷，並預約時段於 9/4-9/6 準時至育樂館進行校內新生健康檢查。', 1, '2025-09-06', '育樂館', '分機2546'],
      [2, '選課規劃', '8/21上午9:00起上網查詢必修課表；選修科目請於加退選期間自行加選，抵免通過科目請自行退選。', 1, '2025-08-29', '資訊電機館', '分機2127'],
      [2, '兵役與證件', '開學日 9/8 起，請攜帶身分證件親自至資訊電機館一樓註冊課務組櫃檯，領取逢甲實體學生證。', 1, '2025-09-08', '資訊電機館', '分機2111'],

      [3, '兵役與證件', '於育樂館現場辦理大三正取生報到，繳交身分證、學歷證明正本及成績單。', 1, '2025-08-05', '育樂館', '分機2124'],
      [3, '帳號申請', '完成報到後啟用網路帳號(NID)，並登入 MyFCU 上傳大頭照以製作實體學生證。', 1, '2025-08-07', '資訊電機館', '分機2708'],
      [3, '兵役與證件', '轉學男生務必登入 MyFCU 填寫兵役狀況調查表，詳填鄰里住址並送出。', 1, '2025-08-06', '行政二館', '分機2225'],
      [3, '學分抵免', '大三轉學涉及高年級專業科目抵免，請備妥成績單與「各科完整每週課綱」，至註冊課務組嚴審。', 1, '2025-09-12', '資訊電機館', '分機2111'],
      [3, '選課規劃', '⚠️ 極度重要：8/5以後報到之大三轉學生，必修課「不會」直接轉入，請務必於加退選期間自行加選所有必/選修課！', 1, '2025-09-19', '資訊電機館', '分機2127'],
      [3, '健康檢查', '上網預約時段，於 9/4-9/6 準時至育樂館完成新生體檢。', 1, '2025-09-06', '育樂館', '分機2546'],
      [3, '兵役與證件', '9/8 開學日起，持身分證件至資電館一樓註冊課務組領取實體學生證。', 1, '2025-09-08', '資訊電機館', '分機2111'],
    ];
    checklistData.forEach(([g, c, t, r, d, b, p]) => {
      db.run('INSERT INTO checklists (target_grade, category, text, is_required, deadline, building, office_phone) VALUES (?, ?, ?, ?, ?, ?, ?)', [g, c, t, r, d, b, p]);
    });
    console.log('✅ checklists 真實數據初始化完成');
  }

  const creditCount = db.exec('SELECT COUNT(*) FROM credit_records')[0]?.values[0][0] ?? 0;
  if (creditCount === 0) {
    db.run("INSERT INTO credit_records (original_school, original_dept, original_course, credits, target_course, status, advice) VALUES ('臺灣大學', '資訊工程學系', '資料結構與演算法', 3, '資料結構', '通過', '完整檢附每週課綱')");
  }

  saveDB();
}

function saveDB() { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
function getDB() { return db; }
export { initDB, getDB, saveDB };