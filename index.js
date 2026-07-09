require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
} = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('./config-store');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  CLIENT_ID,
  VERIFIED_ROLE_ID,
  UNVERIFIED_ROLE_ID,
  VERIFY_CHANNEL_ID,
  WELCOME_CHANNEL_ID,
  ALERT_CHANNEL_ID,
  RAID_JOIN_THRESHOLD,
  RAID_WINDOW_MS,
} = process.env;

const RAID_THRESHOLD = parseInt(RAID_JOIN_THRESHOLD, 10) || 8;
const RAID_WINDOW = parseInt(RAID_WINDOW_MS, 10) || 10000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // can cho lenh !arisbothelp
  ],
  partials: [Partials.GuildMember, Partials.User],
});

// ==== Helper: lay cau hinh hien tai cua 1 guild, uu tien config.json, fallback ve .env ====
function resolveConfig(guildId) {
  const stored = getGuildConfig(guildId);
  return {
    verifyChannelId: stored.verifyChannelId || VERIFY_CHANNEL_ID || null,
    welcomeChannelId: stored.welcomeChannelId || WELCOME_CHANNEL_ID || null,
    verifiedRoleId: stored.verifiedRoleId || VERIFIED_ROLE_ID || null,
    unverifiedRoleId: stored.unverifiedRoleId || UNVERIFIED_ROLE_ID || null,
  };
}

// ==== Theo doi join de phat hien raid ====
let joinTimestamps = [];
let raidModeActive = false;

function recordJoinAndCheckRaid() {
  const now = Date.now();
  joinTimestamps.push(now);
  joinTimestamps = joinTimestamps.filter((t) => now - t <= RAID_WINDOW);
  return joinTimestamps.length >= RAID_THRESHOLD;
}

// ==== Dinh nghia slash commands ====
const commands = [
  new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Cau hinh kenh cho bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('xacminh')
        .setDescription('Chon kenh dung de gui tin nhan xac minh')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Chon 1 kenh trong danh sach')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Chon kenh dung de gui thong bao chao mung / tam biet')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Chon 1 kenh trong danh sach')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Chon role tu dong cap sau khi thanh vien xac minh xong')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Chon 1 role trong danh sach').setRequired(true)
    ),
].map((c) => c.toJSON());

async function registerSlashCommands() {
  if (!CLIENT_ID) {
    console.warn('Thieu CLIENT_ID trong .env, bo qua dang ky slash command.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('Da dang ky slash command cho guild:', GUILD_ID);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Da dang ky slash command global (co the mat toi 1h de hien).');
    }
  } catch (err) {
    console.error('Loi khi dang ky slash command:', err);
  }
}

client.once('ready', async () => {
  console.log(`Bot da dang nhap: ${client.user.tag}`);
  await registerSlashCommands();
  client.guilds.cache.forEach((guild) => sendVerifyMessage(guild.id));
});

// ==== Gui tin nhan co nut "Xac minh" vao kenh da cau hinh (khong gui trung lap) ====
async function sendVerifyMessage(guildId) {
  const { verifyChannelId } = resolveConfig(guildId);
  if (!verifyChannelId) return;
  try {
    const channel = await client.channels.fetch(verifyChannelId);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 20 });
    const already = messages.find(
      (m) => m.author.id === client.user.id && m.embeds[0]?.title === 'Xac minh thanh vien'
    );
    if (already) return;

    const embed = new EmbedBuilder()
      .setTitle('Xac minh thanh vien')
      .setDescription('Nhan nut ben duoi de xac minh va mo khoa server.\nHanh dong nay giup ngan chan bot spam va raid.')
      .setColor(0x5865f2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_button').setLabel('Xac minh').setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Loi khi gui tin nhan verify:', err);
  }
}

// ==== Thanh vien moi join ====
client.on('guildMemberAdd', async (member) => {
  const cfg = resolveConfig(member.guild.id);

  if (cfg.unverifiedRoleId) {
    try {
      await member.roles.add(cfg.unverifiedRoleId);
    } catch (err) {
      console.error('Khong the gan role chua xac minh:', err);
    }
  }

  if (cfg.welcomeChannelId) {
    try {
      const channel = await client.channels.fetch(cfg.welcomeChannelId);
      const embed = new EmbedBuilder()
        .setTitle('Thanh vien moi')
        .setDescription(`Chao mung ${member} da den voi server! Hien co **${member.guild.memberCount}** thanh vien.`)
        .setColor(0x57f287)
        .setThumbnail(member.user.displayAvatarURL());
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Loi khi gui tin nhan chao mung:', err);
    }
  }

  const isRaid = recordJoinAndCheckRaid();
  if (isRaid && !raidModeActive) {
    raidModeActive = true;
    await handleRaidDetected(member.guild);
  }
});

// ==== Thanh vien roi server ====
client.on('guildMemberRemove', async (member) => {
  const cfg = resolveConfig(member.guild.id);
  if (!cfg.welcomeChannelId) return;
  try {
    const channel = await client.channels.fetch(cfg.welcomeChannelId);
    const embed = new EmbedBuilder()
      .setTitle('Thanh vien roi di')
      .setDescription(`${member.user?.tag ?? 'Mot thanh vien'} da roi server.`)
      .setColor(0xed4245);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Loi khi gui tin nhan tam biet:', err);
  }
});

// ==== Phat hien raid ====
async function handleRaidDetected(guild) {
  console.warn(`[CANH BAO] Phat hien kha nang RAID trong server ${guild.name}`);
  if (ALERT_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(ALERT_CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle('CANH BAO: Nghi ngo RAID')
        .setDescription(
          `Phat hien **${joinTimestamps.length}** thanh vien join trong vong ${RAID_WINDOW / 1000} giay.\n` +
          `Vui long kiem tra danh sach thanh vien moi va xu ly neu can.`
        )
        .setColor(0xffcc00);
      await channel.send({ content: '@here', embeds: [embed] });
    } catch (err) {
      console.error('Loi khi gui canh bao raid:', err);
    }
  }
  setTimeout(() => {
    raidModeActive = false;
    joinTimestamps = [];
  }, 10 * 60 * 1000);
}

// ==== Xu ly slash command va nut bam ====
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'verify_button') {
    const cfg = resolveConfig(interaction.guild.id);
    const member = interaction.member;
    try {
      if (cfg.verifiedRoleId) {
        await member.roles.add(cfg.verifiedRoleId);
      } else {
        await interaction.reply({
          content: 'Admin chua thiet lap role xac minh. Dung lenh /autorole de thiet lap.',
          ephemeral: true,
        });
        return;
      }
      if (cfg.unverifiedRoleId && member.roles.cache.has(cfg.unverifiedRoleId)) {
        await member.roles.remove(cfg.unverifiedRoleId);
      }
      await interaction.reply({ content: 'Ban da xac minh thanh cong! Chuc vui ve trong server.', ephemeral: true });
    } catch (err) {
      console.error('Loi khi xac minh thanh vien:', err);
      await interaction.reply({ content: 'Co loi xay ra, vui long lien he admin.', ephemeral: true });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'channel') {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    if (sub === 'xacminh') {
      setGuildConfig(interaction.guild.id, { verifyChannelId: channel.id });
      await interaction.reply({ content: `Da dat kenh xac minh: ${channel}`, ephemeral: true });
      await sendVerifyMessage(interaction.guild.id);
      return;
    }

    if (sub === 'welcome') {
      setGuildConfig(interaction.guild.id, { welcomeChannelId: channel.id });
      await interaction.reply({ content: `Da dat kenh welcome/leave: ${channel}`, ephemeral: true });
      return;
    }
  }

  if (interaction.commandName === 'autorole') {
    const role = interaction.options.getRole('role');
    setGuildConfig(interaction.guild.id, { verifiedRoleId: role.id });
    await interaction.reply({ content: `Da dat role tu dong cap sau xac minh: ${role}`, ephemeral: true });
    return;
  }
});

// ==== Lenh !arisbothelp ====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== '!arisbothelp') return;

  const embed = new EmbedBuilder()
    .setTitle('Huong dan su dung Aris Bot')
    .setColor(0x5865f2)
    .setDescription('Danh sach lenh hien co:')
    .addFields(
      { name: '/channel xacminh [channel]', value: 'Chon kenh de bot gui tin nhan xac minh (chi admin).' },
      { name: '/channel welcome [channel]', value: 'Chon kenh de bot gui thong bao chao mung / tam biet (chi admin).' },
      { name: '/autorole [role]', value: 'Chon role tu dong cap cho thanh vien sau khi xac minh xong (chi admin).' },
      { name: '!arisbothelp', value: 'Hien thi bang huong dan nay.' }
    )
    .setFooter({ text: 'Chi thanh vien co quyen Manage Server moi dung duoc /channel va /autorole' });

  await message.reply({ embeds: [embed] });
});

client.login(DISCORD_TOKEN);
