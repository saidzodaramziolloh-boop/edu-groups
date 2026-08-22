# EduGroups + MongoDB

Платформаи гуруҳҳои дарсӣ бо Socket.io ва MongoDB.

## 1. MongoDB-ро пайваст кунед

### Варианти А: MongoDB Atlas (тавсия — озод ва осон)

1. Ба [mongodb.com/atlas](https://www.mongodb.com/atlas) равед ва ҳисоб кушоед
2. Кластери озод (Free / M0) созед
3. Database Access → корбар созед (username + password)
4. Network Access → `0.0.0.0/0` илова кунед (барои тест)
5. Connect → Drivers → пайвандро нусха бардоред  
   Мисол:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/edugroups?retryWrites=true&w=majority
   ```

6. Пеш аз `npm start` инро гузоред:

**Windows (PowerShell):**
```powershell
$env:MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/edugroups"
npm start
```

**Linux / Mac:**
```bash
export MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/edugroups"
npm start
```

### Варианти Б: MongoDB Local

1. MongoDB-ро насб кунед: https://www.mongodb.com/try/download/community
2. Хидматро оғоз кунед
3. Танҳо `npm start` — худкор ба `mongodb://127.0.0.1:27017/edugroups` пайваст мешавад

## 2. Оғоз

```bash
cd edu-server
npm install
npm start
```

Браузер: http://localhost:3000

**Админи асосӣ:** `admin`

## Чӣ захира мешавад
- Корбарон
- Гуруҳҳо
- Паёмҳо
- Нуқтаҳои мусобиқа

Ҳатто агар серверро хомӯш кунед, маълумотҳо боқӣ мемонанд.
