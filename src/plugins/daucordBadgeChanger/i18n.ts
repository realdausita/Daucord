/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const GROUP_TR: Record<string, string> = {
    Discord: "Discord",
    Special: "Özel",
    Gifting: "Hediye",
    Nitro: "Nitro",
    "Server Boost": "Sunucu Takviyesi",
    "Account Age": "Hesap Yaşı",
    Streaming: "Yayın",
    "Game Time": "Oyun Süresi",
    "Game Variety": "Oyun Çeşitliliği",
    Custom: "Özel"
};

const LABELS_TR: Record<string, string> = {
    "Discord Staff": "Discord Personeli",
    "Partnered Server Owner": "Partner Sunucu Sahibi",
    "Moderator Programs Alumni": "Moderatör Programları Mezunu",
    "HypeSquad Events": "HypeSquad Etkinlikleri",
    "HypeSquad Bravery": "HypeSquad Cesareti",
    "HypeSquad Brilliance": "HypeSquad Parlaklığı",
    "HypeSquad Balance": "HypeSquad Dengesi",
    "Early Supporter": "Erken Destekçi",
    "Bug Hunter Level 2": "Hata Avcısı Seviye 2",
    "Bug Hunter Level 1": "Hata Avcısı Seviye 1",
    "Early Verified Bot Developer": "Erken Doğrulanmış Bot Geliştiricisi",
    "Active Developer": "Aktif Geliştirici",
    "Completed a quest": "Bir görevi tamamladı",
    "Last Meadow Online": "Son Meadow'da çevrimiçi",
    "Orbs — Apprentice": "Orbs — Çırak",
    "Gifting — Patron": "Hediye — Patron",
    "Gifting — Champion": "Hediye — Şampiyon",
    "Gifting — Luminary": "Hediye — Işık Kaynağı",
    "Gifting — Icon": "Hediye — İkon",
    "Gifting — Hero": "Hediye — Kahraman",
    "Gifting — Legendary": "Hediye — Efsane",
    "Nitro (0 months)": "Nitro (0 ay)",
    "Bronze (1 month)": "Bronz (1 ay)",
    "Silver (3 months)": "Gümüş (3 ay)",
    "Gold (6 months)": "Altın (6 ay)",
    "Platinum (12 months)": "Platin (12 ay)",
    "Diamond (24 months)": "Elmas (24 ay)",
    "Emerald (36 months)": "Zümrüt (36 ay)",
    "Ruby (60 months)": "Yakut (60 ay)",
    "Opal (72 months)": "Opal (72 ay)",
    "1 Month Server Boost": "1 Ay Sunucu Takviyesi",
    "2 Months Server Boost": "2 Ay Sunucu Takviyesi",
    "3 Months Server Boost": "3 Ay Sunucu Takviyesi",
    "6 Months Server Boost": "6 Ay Sunucu Takviyesi",
    "9 Months Server Boost": "9 Ay Sunucu Takviyesi",
    "12 Months Server Boost": "12 Ay Sunucu Takviyesi",
    "15 Months Server Boost": "15 Ay Sunucu Takviyesi",
    "18 Months Server Boost": "18 Ay Sunucu Takviyesi",
    "24 Months Server Boost": "24 Ay Sunucu Takviyesi",
    "Seed Account Age": "Tohum Hesap Yaşı",
    "Sprout Account Age": "Filiz Hesap Yaşı",
    "Sapling Account Age": "Fidan Hesap Yaşı",
    "Bud Account Age": "Tomurcuk Hesap Yaşı",
    "Blossom Account Age": "Çiçek Hesap Yaşı",
    "Redwood Account Age": "Kızılçam Hesap Yaşı",
    "Sequoia Account Age": "Sekoya Hesap Yaşı",
    "Bristlecone Account Age": "Bristlecone Çamı Hesap Yaşı",
    "Stromatolite Account Age": "Stromatolit Hesap Yaşı",
    "Primordial Account Age": "İlkel Hesap Yaşı",
    "Newcomer Streaming": "Yeni Gelen Yayın",
    "Fledgling Streaming": "Yavru Yayın",
    "Breakout Streaming": "Atılım Yayın",
    "Standout Streaming": "Öne Çıkan Yayın",
    "Trendsetter Streaming": "Trend Belirleyici Yayın",
    "Headliner Streaming": "Manşet Yayın",
    "Star Streaming": "Yıldız Yayın",
    "Sensation Streaming": "Sansasyon Yayın",
    "Visionary Streaming": "Vizyoner Yayın",
    "Phenomenon Streaming": "Fenomen Yayın",
    "Casual Game Time": "Rahat Oyun Süresi",
    "Recreational Game Time": "Dinlendirici Oyun Süresi",
    "Dedicated Game Time": "Adanmış Oyun Süresi",
    "Committed Game Time": "Kararlı Oyun Süresi",
    "Serious Game Time": "Ciddi Oyun Süresi",
    "Devoted Game Time": "Özverili Oyun Süresi",
    "Seasoned Game Time": "Tecrübeli Oyun Süresi",
    "Ironclad Game Time": "Zırhlı Oyun Süresi",
    "Unshakeable Game Time": "Sarsılmaz Oyun Süresi",
    "Eternal Game Time": "Ebedi Oyun Süresi",
    "Sampler Game Variety": "Tadım Oyun Çeşitliliği",
    "Dabbler Game Variety": "Meraklı Oyun Çeşitliliği",
    "Enthusiast Game Variety": "Hevesli Oyun Çeşitliliği",
    "Ranger Game Variety": "Gezgin Oyun Çeşitliliği",
    "Explorer Game Variety": "Kâşif Oyun Çeşitliliği",
    "Adventurer Game Variety": "Maceracı Oyun Çeşitliliği",
    "Voyager Game Variety": "Yolcu Oyun Çeşitliliği",
    "Maverick Game Variety": "Bağımsız Oyun Çeşitliliği",
    "Polymath Game Variety": "Polimat Oyun Çeşitliliği",
    "Universalist Game Variety": "Evrensel Oyun Çeşitliliği"
};

export const isTurkish = () => (navigator.language || "").toLowerCase().startsWith("tr");

export function localizeLabel(label: string, group: string) {
    if (!isTurkish()) return label;
    return LABELS_TR[label] ?? label;
}

export function localizeGroup(group: string) {
    return isTurkish() ? (GROUP_TR[group] ?? group) : group;
}
