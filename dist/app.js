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
        await db.execute('INSERT INTO todos (todo, dueDate, priority) VALUES (?, ?, ?)', [todo, dueDate, priority]);
        res.redirect('/home');
    });
    app.put('/update/:id', async (req, res) => {
        const todoId = req.params.id;
        const { todo, dueDate, priority } = req.body;
        await db.execute('UPDATE todos SET todo = ?, dueDate = ?, priority = ? WHERE id = ?', [todo, dueDate, priority, todoId]);
        res.redirect('/home');
    });
    app.get('/home', async (req, res) => {
        const [rows] = await db.execute('SELECT * FROM todos');
        console.log('Rendering home page');
        res.render('home', { todos: rows });
    });
    app.post('/details/:id', async (req, res) => {
        const todoId = req.params.id;
        const [rows] = await db.query('SELECT * FROM todos WHERE id = ?', [todoId]);
        if (rows.length > 0) {
            res.render('details', { todo: rows[0] });
        }
        else {
            res.status(404).send('Todo not found');
        }
    });
    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}
initializeApp();
