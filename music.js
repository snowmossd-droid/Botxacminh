// Duong dan ffmpeg tinh (bundled san), can khai bao TRUOC khi require @discordjs/voice
process.env.FFMPEG_PATH = require('ffmpeg-static');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');

// Luu 1 "session" (ket noi voice + player) cho tung guild, trong bo nho
// Se mat khi bot restart (binh thuong doi voi bot nhac, nguoi dung chi can go lai !music)
const sessions = new Map(); // guildId -> { connection, player, voiceChannelId, textChannelId }

function getSession(guildId) {
  return sessions.get(guildId);
}

function destroySession(guildId) {
  const session = sessions.get(guildId);
  if (session) {
    try {
      session.player.stop();
      session.connection.destroy();
    } catch {
      // bo qua neu da bi huy san
    }
    sessions.delete(guildId);
  }
}

/**
 * Xu ly lenh !music <ten bai hat>
 * @param {import('discord.js').Message} message
 * @param {string} query
 */
async function handleMusicCommand(message, query) {
  if (!query || !query.trim()) {
    await message.reply('Ban can nhap ten bai hat. Vi du: `!music never gonna give you up`');
    return;
  }

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply('Ban can vao 1 kenh voice truoc khi dung lenh nay.');
    return;
  }

  const botPermissions = voiceChannel.permissionsFor(message.guild.members.me);
  if (!botPermissions?.has(['Connect', 'Speak'])) {
    await message.reply('Bot khong co quyen Connect/Speak trong kenh voice nay. Nho admin cap quyen giup.');
    return;
  }

  const searching = await message.reply(`Dang tim: **${query}**...`);

  let result;
  try {
    const found = await play.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!found || found.length === 0) {
      await searching.edit('Khong tim thay bai hat nao phu hop.');
      return;
    }
    result = found[0];
  } catch (err) {
    console.error('Loi khi tim bai hat:', err);
    await searching.edit('Co loi khi tim bai hat, thu lai sau.');
    return;
  }

  let stream;
  try {
    stream = await play.stream(result.url);
  } catch (err) {
    console.error('Loi khi lay stream audio:', err);
    await searching.edit('Khong the phat bai nay (co the bi gioi han tuoi hoac khong kha dung).');
    return;
  }

  // Dong session cu neu co, truoc khi tao session moi
  destroySession(message.guild.id);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(stream.stream, { inputType: stream.type ?? StreamType.Arbitrary });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    console.error('Ket noi voice khong san sang:', err);
    connection.destroy();
    await searching.edit('Khong the ket noi vao kenh voice, thu lai sau.');
    return;
  }

  connection.subscribe(player);
  player.play(resource);

  sessions.set(message.guild.id, {
    connection,
    player,
    voiceChannelId: voiceChannel.id,
    textChannelId: message.channel.id,
  });

  await searching.edit(`Dang phat: **${result.title}**\n${result.url}`);

  player.on(AudioPlayerStatus.Idle, () => {
    // Bai hat phat xong, tu roi kenh voice sau 60 giay neu khong co bai moi
    setTimeout(() => {
      const current = sessions.get(message.guild.id);
      if (current && current.player.state.status === AudioPlayerStatus.Idle) {
        destroySession(message.guild.id);
      }
    }, 60_000);
  });

  player.on('error', (err) => {
    console.error('Loi audio player:', err);
    message.channel.send('Co loi xay ra trong luc phat nhac.').catch(() => {});
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    destroySession(message.guild.id);
  });
}

/**
 * Xu ly lenh !stop - dung nhac va roi kenh voice
 * @param {import('discord.js').Message} message
 */
async function handleStopCommand(message) {
  const session = getSession(message.guild.id);
  if (!session) {
    await message.reply('Bot hien khong phat nhac o day.');
    return;
  }
  destroySession(message.guild.id);
  await message.reply('Da dung nhac va roi kenh voice.');
}

module.exports = { handleMusicCommand, handleStopCommand };
