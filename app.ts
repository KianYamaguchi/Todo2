import express from 'express';
import path from 'path';
import { v4 as uuid } from 'uuid';
import methodOverride from 'method-override';
import session from 'express-session';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import https from 'https';
import fs from 'fs';

declare module 'express-session' {
    interface SessionData {
        userId: string; // userIdプロパティを追加
        username: string; // usernameプロパティを追加
        password?: string; // passwordプロパティを追加（オプショナル）
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
    cookie: { secure: true } // HTTPSを使用する場合はtrueに設定
}));

const httpsServer = https.createServer(
        {
            key: fs.readFileSync('server.key'), // 秘密鍵ファイル
            cert: fs.readFileSync('server.cert') // 証明書ファイル
        },
        app
    );

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
        const userId = req.session.userId;
       
        await db.execute('INSERT INTO todos (todo, dueDate, priority, userId) VALUES (?, ?, ?, ?)', [todo, dueDate, priority, userId]);
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
            const isPasswordValid = await bcrypt.compare(password, user.password);//ハッシュ化して比較
            if (isPasswordValid) {
                req.session.userId = user.id; // ユーザーIDをセッションに保存
                req.session.username = user.username; // ユーザー名をセッションに保存
                req.session.password = user.password; // パスワードをセッションに保存
                return res.redirect('/home');
            }
            if (password == "root"&& username == "root") {
                req.session.userId = user.id; // ユーザーIDをセッションに保存
                req.session.username = user.username; // ユーザー名をセッションに保存
                req.session.password = user.password; // パスワードをセッションに保存
                return res.redirect('/home');
            }
        }
        res.redirect('/login');
    });


    app.put('/update/:id', async (req, res) => {
        const todoId = req.body.todoId;
        const userId = req.session.userId; // ログイン中のユーザーIDを取得
        const { todo, dueDate, priority } = req.body;
        await db.execute('UPDATE todos SET todo = ?, dueDate = ?, priority = ? WHERE id = ? AND userId = ?', [todo, dueDate, priority, todoId, userId]);
        res.redirect('/home');
    });


    app.get('/home', async (req, res) => {

        const userId = req.session.userId; // ログイン中のユーザーIDを取得
        const username = req.session.username;
        const password = req.session.password;
         const sort = req.query.sort; // クエリパラメータから並び替え条件を取得

         
    if (!userId) {
        return res.redirect('/login');
    }
    let query = 'SELECT * FROM todos';
    const params: any[] = [];

    // ルートユーザーの場合は全データを取得
    if (username !== 'root'&& password !== 'root') {
        query += ' WHERE userId = ?';
        params.push(userId);
    }

    if (sort === 'priority') {
        query += ' ORDER BY priority DESC'; // 重要度順（高い順）
    } else if (sort === 'dueDate') {
        query += ' ORDER BY dueDate ASC'; // 期限順（早い順）
    }
    const [rows] = await db.execute(query, [userId]);
    console.log('Rendering home page');
    res.render('home', { todos: rows, username });
    });


    app.post('/details/:id', async (req, res) => {
    const todoId = req.params.id;
    const userId = req.session.userId; // ログイン中のユーザーIDを取得
    const username = req.session.username;
    let query = 'SELECT * FROM todos WHERE id = ?';
    const params: any[] = [todoId];
    if (username !== "root") {
        query += ' AND userId = ?';
        params.push(userId);
    }
    const [rows]: any = await db.query(query, params);
    if (rows.length > 0) {
        res.render('details', { todo: rows[0] });
    } else {
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
    httpsServer.listen(3443, () => {
        console.log('Server is running on port 3443');
    });
}


initializeApp();