import express from 'express';
import path from 'path';
import { v4 as uuid } from 'uuid';
import methodOverride from 'method-override';
import session from 'express-session';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
declare module 'express-session' {
    interface SessionData {
        userId: string; // userIdプロパティを追加
    }
}


async function initializeApp() {
    const db = await mysql.createConnection({
        host: 'localhost', // MySQLサーバーのホスト名
        user: 'root',      // MySQLユーザー名
        password: 'root',  // MySQLパスワード
        database: 'todos'  // 使用するデータベース名
    });

    console.log('Connected to MySQL database');

    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(methodOverride('_method'));
    app.use(express.static(path.join(__dirname, 'dist/public')));
    app.use(express.urlencoded({ extended: true })); // 追加: URLエンコードされたデータのパース
    app.use(session({
    secret: 'your-secret-key', // セッションの暗号化キー
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // HTTPSを使用する場合はtrueに設定
}));



    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'dist/views'));



    app.get('/',(req, res) => {
        res.send('Hello, World!')
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

    app.get('/register', (req, res) => {
        res.render('register');
    });

    app.post('/register', async (req, res) => {
        const { username, password, email } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email]);
        res.redirect('/login');
    });

    app.get('/login', (req, res) => {
        res.render('login');
    });

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        const [rows]: any = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (isPasswordValid) {
                req.session.userId = user.id;
                return res.redirect('/home');
            }
        }
        res.redirect('/login');
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
    const [rows]: any = await db.query('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (rows.length > 0) {
        res.render('details', { todo: rows[0] });
    } else {
        res.status(404).send('Todo not found');
    }
});
    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}

initializeApp();