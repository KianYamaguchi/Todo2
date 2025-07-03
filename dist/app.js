"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const method_override_1 = __importDefault(require("method-override"));
const express_session_1 = __importDefault(require("express-session"));
const promise_1 = __importDefault(require("mysql2/promise"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function initializeApp() {
    const db = await promise_1.default.createConnection({
        host: 'localhost', // MySQLサーバーのホスト名
        user: 'root', // MySQLユーザー名
        password: 'root', // MySQLパスワード
        database: 'todos' // 使用するデータベース名
    });
    console.log('Connected to MySQL database');
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, method_override_1.default)('_method'));
    app.use(express_1.default.static(path_1.default.join(__dirname, 'dist/public')));
    app.use(express_1.default.urlencoded({ extended: true })); // 追加: URLエンコードされたデータのパース
    app.use((0, express_session_1.default)({
        secret: 'your-secret-key', // セッションの暗号化キー
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false } // HTTPSを使用する場合はtrueに設定
    }));
    app.set('view engine', 'ejs');
    app.set('views', path_1.default.join(__dirname, 'dist/views'));
    app.get('/', (req, res) => {
        res.send('Hello, World!');
    });
    app.delete('/delete/:id', async (req, res) => {
        const todoId = req.params.id;
        await db.execute('DELETE FROM todos WHERE id = ?', [todoId]);
        res.redirect('/home');
    });
    app.post('/add', async (req, res) => {
        const { todo, dueDate, priority } = req.body;
        const userId = req.session.userId;
        await db.execute('INSERT INTO todos (todo, dueDate, priority, userId) VALUES (?, ?, ?, ?)', [todo, dueDate, priority, userId]);
        res.redirect('/home');
    });
    app.get('/register', (req, res) => {
        res.render('register');
    });
    app.post('/register', async (req, res) => {
        const { username, password, email } = req.body;
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        await db.execute('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email]);
        res.redirect('/login');
    });
    app.get('/login', (req, res) => {
        res.render('login');
    });
    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
            if (isPasswordValid) {
                req.session.userId = user.id; // ユーザーIDをセッションに保存
                req.session.username = user.username; // ユーザー名をセッションに保存
                return res.redirect('/home');
            }
        }
        res.redirect('/login');
    });
    app.put('/update/:id', async (req, res) => {
        const todoId = req.params.id;
        const userId = req.session.userId; // ログイン中のユーザーIDを取得
        const { todo, dueDate, priority } = req.body;
        await db.execute('UPDATE todos SET todo = ?, dueDate = ?, priority = ? WHERE id = ? AND userId = ?', [todo, dueDate, priority, todoId, userId]);
        res.redirect('/home');
    });
    app.get('/home', async (req, res) => {
        const userId = req.session.userId; // ログイン中のユーザーIDを取得
        const username = req.session.username;
        const sort = req.query.sort; // クエリパラメータから並び替え条件を取得
        if (!userId) {
            return res.redirect('/login');
        }
        let query = 'SELECT * FROM todos WHERE userId = ?';
        if (sort === 'priority') {
            query += ' ORDER BY priority DESC'; // 重要度順（高い順）
        }
        else if (sort === 'dueDate') {
            query += ' ORDER BY dueDate ASC'; // 期限順（早い順）
        }
        const [rows] = await db.execute(query, [userId]);
        console.log('Rendering home page');
        res.render('home', { todos: rows, username });
    });
    app.post('/details/:id', async (req, res) => {
        const todoId = req.params.id;
        const userId = req.session.userId; // ログイン中のユーザーIDを取得
        const [rows] = await db.query('SELECT * FROM todos WHERE id = ? AND userId = ?', [todoId, userId]);
        if (rows.length > 0) {
            res.render('details', { todo: rows[0] });
        }
        else {
            res.status(404).send('Todo not found');
        }
    });
    app.get('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                console.error(err);
                return res.status(500).send('ログアウト中にエラーが発生しました');
            }
            res.redirect('/login'); // ログアウト後にログインページへリダイレクト
        });
    });
    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}
initializeApp();
