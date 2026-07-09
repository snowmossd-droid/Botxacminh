# Discord Bot: Xac Minh + Chong Raid + Welcome/Leave

## 1. Tao bot tren Discord Developer Portal
1. Vao https://discord.com/developers/applications -> New Application
2. Vao tab **Bot** -> Add Bot -> copy **Token** (giu bi mat, khong chia se)
3. Trong tab **General Information**, copy **Application ID** -> dien vao `CLIENT_ID` trong `.env`
4. Trong tab Bot, bat cong tac trong muc "Privileged Gateway Intents":
   - SERVER MEMBERS INTENT (bat buoc, de biet ai join/leave)
   - MESSAGE CONTENT INTENT (bat buoc, de nhan dien lenh `!arisbothelp`)
5. Vao tab **OAuth2 -> URL Generator**:
   - Scopes: chon `bot` va `applications.commands` (bat buoc de dung duoc slash command)
   - Permissions: it nhat can `Manage Roles`, `Send Messages`, `Embed Links`, `View Channels`
   - Copy link tao ra, mo link va moi bot vao server cua ban

## 2. Cau hinh file .env
Doi ten `.env.example` thanh `.env`, dien `DISCORD_TOKEN`, `CLIENT_ID`, va `GUILD_ID` (Server ID, bat Developer Mode trong Settings -> Advanced de lay).

**Luu y:** Voi phien ban moi nay, ban KHONG can dien san `VERIFY_CHANNEL_ID`, `WELCOME_CHANNEL_ID`, `VERIFIED_ROLE_ID` trong `.env` nua — cau hinh nhung thu nay bang lenh slash ngay trong Discord (xem phan 4).

**QUAN TRONG:** Khong bao gio commit file `.env` len GitHub. File `.gitignore` da duoc tao san de tu dong bo qua file nay.

## 3. Chay thu tren may local
```bash
npm install
npm start
```
Neu thay dong "Bot da dang nhap: <ten_bot>#xxxx" trong terminal la bot da hoat dong. Slash command se tu dong dang ky khi bot khoi dong (mat vai giay neu dang ky theo GUILD_ID, khoang 1h neu dang ky global).

## 4. Cau hinh bot qua lenh Discord (chi Admin / nguoi co quyen Manage Server)
Vao server, go cac lenh sau:

- `!arisbothelp` — Hien bang huong dan tat ca lenh.
- `/channel xacminh` rồi chon 1 kenh trong dropdown Discord tu dong hien thi — dat kenh de bot gui tin nhan nut "Xac minh".
- `/channel welcome` rồi chon 1 kenh — dat kenh nhan thong bao chao mung khi co nguoi join va tam biet khi co nguoi roi (dung chung 1 kenh cho ca hai).
- `/autorole` rồi chon 1 role trong dropdown — dat role se tu dong cap cho thanh vien ngay sau khi ho bam nut xac minh.

Cau hinh duoc luu vao file `config.json`, tu dong ap dung tu lan sau, khong can dat lai moi khi bot restart (mien la file nay khong bi xoa — xem luu y o phan 6 neu dung GitHub Actions).

Neu muon co role "chua xac minh" (gioi han quyen truoc khi xac minh), dien thu cong `UNVERIFIED_ROLE_ID` trong `.env` (chua co lenh rieng cho phan nay, co the them sau neu can).

## 5. Cach hoat dong
- **Xac minh**: Bot gui 1 tin nhan co nut "Xac minh" vao kenh da cau hinh. Thanh vien moi join se duoc gan role Unverified (neu cau hinh trong .env), phai bam nut moi duoc gan role da chon o `/autorole` va go role Unverified.
- **Welcome/Leave**: Moi khi co nguoi vao/roi server, bot gui embed thong bao vao kenh da cau hinh o `/channel welcome`.
- **Chong raid**: Bot dem so luong thanh vien join trong khoang RAID_WINDOW_MS (mac dinh 10 giay, chinh trong .env). Neu vuot qua RAID_JOIN_THRESHOLD (mac dinh 8 nguoi), bot gui canh bao vao kenh ALERT_CHANNEL_ID (van dat qua .env) de admin/mod kiem tra thu cong.

## 6. Deploy 24/7

### Cach A: Render.com (khuyen nghi, don gian nhat, khong lo mat config)
Xem huong dan rieng da trao doi truoc do — dung Background Worker, config.json giu nguyen tren dia giua cac lan chay (tru khi ban push code moi len GitHub, luc do Render auto-deploy lai va config bi mat theo).

### Cach B: GitHub Actions (khong can Render, nhung setup phuc tap hon)
File `.github/workflows/bot.yml` da duoc tao san, chay lai moi 5 tieng (duoi gioi han 6h/job cua GitHub). De **khong bi mat config** moi lan chay lai, bot se tu dong `git commit` + `git push` file `config.json` nguoc ve repo moi khi ban dung lenh `/channel` hoac `/autorole`. Lan chay tiep theo se tu dong checkout duoc config moi nhat.

**Cac buoc setup:**

1. Tao 1 **Personal Access Token (PAT)** rieng de bot dung push code (khong dung GITHUB_TOKEN mac dinh vi mot so repo gioi han quyen cua no):
   - Vao **GitHub -> Settings (tai khoan ca nhan) -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token**
   - Repository access: chon dung repo bot cua ban
   - Permissions: **Contents -> Read and write**
   - Tao token, copy lai (chi hien 1 lan)

2. Vao repo GitHub cua bot -> **Settings -> Secrets and variables -> Actions -> New repository secret**, tao cac secret sau:
   - `DISCORD_TOKEN` — token bot
   - `CLIENT_ID` — Application ID
   - `GUILD_ID` — ID server
   - `GH_PUSH_TOKEN` — chinh la PAT vua tao o buoc 1
   - `UNVERIFIED_ROLE_ID`, `ALERT_CHANNEL_ID` — neu co dung

3. Push toan bo code (bao gom `.github/workflows/bot.yml`) len GitHub. Vao tab **Actions** cua repo, workflow "Discord Bot Runner" se tu chay theo lich, hoac ban bam **Run workflow** de chay thu ngay.

**Han che can biet:**
- Bot se **offline vai phut moi 5 tieng** trong luc job cu ket thuc va job moi khoi dong lai — khong phai 24/7 tuyet doi 100%.
- Neu ban dung 2 nguoi cung sua `config.json` (vi du 1 nguoi bam `/autorole` dung luc job dang push) co the xay ra xung dot git hiem gap — trong truong hop nay bot se log loi push nhung khong crash, ban chi can chay lai lenh 1 lan nua.
- Cach nay dung git cua chinh repo lam "database" nen chi phu hop quy mo nho (1 vai server), khong nen dung cho bot lon nhieu server.

Neu muon on dinh hon va khong lo cac han che tren, **Render.com (Cach A) van la lua chon de dung hon.**
