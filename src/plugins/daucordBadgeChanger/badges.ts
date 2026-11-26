/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgePreset {
    key: string;
    label: string;
    icon: string;
    group: string;
}

export const BADGE_PRESETS: BadgePreset[] = [
    {
        "key": "flag_discord_staff",
        "label": "Discord Staff",
        "icon": "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png",
        "group": "Discord"
    },
    {
        "key": "flag_partnered_server_owner",
        "label": "Partnered Server Owner",
        "icon": "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png",
        "group": "Discord"
    },
    {
        "key": "flag_moderator_programs_alumni",
        "label": "Moderator Programs Alumni",
        "icon": "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png",
        "group": "Discord"
    },
    {
        "key": "flag_hypesquad_events",
        "label": "HypeSquad Events",
        "icon": "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png",
        "group": "Discord"
    },
    {
        "key": "flag_hypesquad_bravery",
        "label": "HypeSquad Bravery",
        "icon": "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png",
        "group": "Discord"
    },
    {
        "key": "flag_hypesquad_brilliance",
        "label": "HypeSquad Brilliance",
        "icon": "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png",
        "group": "Discord"
    },
    {
        "key": "flag_hypesquad_balance",
        "label": "HypeSquad Balance",
        "icon": "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png",
        "group": "Discord"
    },
    {
        "key": "flag_early_supporter",
        "label": "Early Supporter",
        "icon": "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png",
        "group": "Discord"
    },
    {
        "key": "flag_bug_hunter_level_2",
        "label": "Bug Hunter Level 2",
        "icon": "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png",
        "group": "Discord"
    },
    {
        "key": "flag_bug_hunter_level_1",
        "label": "Bug Hunter Level 1",
        "icon": "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png",
        "group": "Discord"
    },
    {
        "key": "flag_early_verified_bot_developer",
        "label": "Early Verified Bot Developer",
        "icon": "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png",
        "group": "Discord"
    },
    {
        "key": "flag_active_developer",
        "label": "Active Developer",
        "icon": "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png",
        "group": "Discord"
    },
    {
        "key": "quest",
        "label": "Completed a quest",
        "icon": "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png",
        "group": "Special"
    },
    {
        "key": "meadow",
        "label": "Last Meadow Online",
        "icon": "https://cdn.discordapp.com/badge-icons/ca105ad9cfc8580c765101d17bbb2323.png",
        "group": "Special"
    },
    {
        "key": "orbs",
        "label": "Orbs — Apprentice",
        "icon": "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png",
        "group": "Special"
    },
    {
        "key": "gift_patron",
        "label": "Gifting — Patron",
        "icon": "https://cdn.discordapp.com/assets/content/5a2c578f82445956549c6454a2d65f8ba35b53f59120a4aa55855098ce5a653d.png",
        "group": "Gifting"
    },
    {
        "key": "gift_champion",
        "label": "Gifting — Champion",
        "icon": "https://cdn.discordapp.com/assets/content/ac865fd339fbaa75d77278cd695936f168cd9b88dbbd72fdaeb76174bc0039d3.png",
        "group": "Gifting"
    },
    {
        "key": "gift_luminary",
        "label": "Gifting — Luminary",
        "icon": "https://cdn.discordapp.com/assets/content/35885be90179a2b4cc4e29aaf1285fe561c837f037aa805df40e921fd8db4867.png",
        "group": "Gifting"
    },
    {
        "key": "gift_icon",
        "label": "Gifting — Icon",
        "icon": "https://cdn.discordapp.com/assets/content/70b46c1ea400bc57e2d5ac937c70b7ef25599feb1c62d7817c257f19051f1460.png",
        "group": "Gifting"
    },
    {
        "key": "gift_hero",
        "label": "Gifting — Hero",
        "icon": "https://cdn.discordapp.com/assets/content/779d517e251fd2f6c4d64b4bf5839ea20cc5e061a2f971c7811ab2486ccf4553.png",
        "group": "Gifting"
    },
    {
        "key": "gift_legendary",
        "label": "Gifting — Legendary",
        "icon": "https://cdn.discordapp.com/assets/content/eb5ce89c01c7884a614b5be0ebadb0d86215b61b55c04a01d27cffb131b4a070.png",
        "group": "Gifting"
    },
    {
        "key": "nitro_nitro_0_months_",
        "label": "Nitro (0 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_bronze_1_month_",
        "label": "Bronze (1 month)",
        "icon": "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_silver_3_months_",
        "label": "Silver (3 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_gold_6_months_",
        "label": "Gold (6 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_platinum_12_months_",
        "label": "Platinum (12 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_diamond_24_months_",
        "label": "Diamond (24 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_emerald_36_months_",
        "label": "Emerald (36 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_ruby_60_months_",
        "label": "Ruby (60 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png",
        "group": "Nitro"
    },
    {
        "key": "nitro_opal_72_months_",
        "label": "Opal (72 months)",
        "icon": "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png",
        "group": "Nitro"
    },
    {
        "key": "boost_0",
        "label": "1 Month Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_1",
        "label": "2 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_2",
        "label": "3 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_3",
        "label": "6 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_4",
        "label": "9 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_5",
        "label": "12 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_6",
        "label": "15 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_7",
        "label": "18 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png",
        "group": "Server Boost"
    },
    {
        "key": "boost_8",
        "label": "24 Months Server Boost",
        "icon": "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png",
        "group": "Server Boost"
    },
    {
        "key": "account_age_seed",
        "label": "Seed Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/8da9339b9d405f0194947e607c839b1bd43436211e5bf07fe7f4ce005578e9e4.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_sprout",
        "label": "Sprout Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/f12847ebadd9022c3d67e5b31b5f3608e1ff48a222528fb6059e0fd310fc71b7.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_sapling",
        "label": "Sapling Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/dccc28b53d39406e65e76541d6b940b23a9d31ef418100d77d6eb30c4adb9098.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_bud",
        "label": "Bud Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/7c0a10981060861722c0216fd6c01a9fd8b10accbd3d6a04dcde275896e82e8b.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_blossom",
        "label": "Blossom Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/52c374af536a4621a65503b4350f7459e3d00f3ed4e3b941c3902c0d9af45f4a.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_redwood",
        "label": "Redwood Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/8041acaf604df1ace1ad2a12fd020513e50dfdd09899dc2e455e622d41c91000.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_sequoia",
        "label": "Sequoia Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/7c5a1b1ce27181145c7e37bf6ad323353c14e8db201cfa3cb336292ad9a5d03d.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_bristlecone",
        "label": "Bristlecone Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/53b3a2b4307df9dfc05a4c9da977baa4a6fd822f5a3d24843f949d1c93398322.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_stromatolite",
        "label": "Stromatolite Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/d30993594816cc6035041941291dc7a5862e55676ce85eef91f89fd0c59f2931.png",
        "group": "Account Age"
    },
    {
        "key": "account_age_primordial",
        "label": "Primordial Account Age",
        "icon": "https://cdn.discordapp.com/assets/content/1930d04a8a1d0aba6f97b19b7e7b87158ab154ebffd5468d6ada66671285968b.png",
        "group": "Account Age"
    },
    {
        "key": "streaming_newcomer",
        "label": "Newcomer Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/571a6f607289dfc034d5735ea020bb53f29e9d53dcc54ee852f9f070538ff73a.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_fledgling",
        "label": "Fledgling Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/3e1ec0a72ca812e53ecd53d55c18c2d9765cc89eee08b1e74f7e0bdbfe2e96a2.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_breakout",
        "label": "Breakout Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/443707ffced738635bb0ee5c054544c67ec9dfab63b03e661bc1295d5399cac7.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_standout",
        "label": "Standout Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/522de4edcb75e0544633b9ccb55c58d672c4a2fa70a81231bd42bb56cd6555bd.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_trendsetter",
        "label": "Trendsetter Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/9482ad3a1104986a4cce2979291c733eca0707f6218ddfb6ff36e32e3fd709e9.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_headliner",
        "label": "Headliner Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/2cf2a4ab39800a963efdb900b823dc8ccb23464434f3e11d329851ae566cac22.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_star",
        "label": "Star Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/20e0b4ff7fc63681efe95082a69f9bfe7259f1485fa6fa6cebaf709336f42b90.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_sensation",
        "label": "Sensation Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/7ceb7fc55dba1fd4c4c5a9acd8345e3b74bca789bf8503445f3bf89109ae47a4.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_visionary",
        "label": "Visionary Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/5fbabf24366e08c5f7a56219d7d39f29c41034b5bd091573600f07a904af0035.png",
        "group": "Streaming"
    },
    {
        "key": "streaming_phenomenon",
        "label": "Phenomenon Streaming",
        "icon": "https://cdn.discordapp.com/assets/content/dd20ac476f0bb7ea9a553abc699c0d6b9854a3f802187e3bf9bf2e45c37a766a.png",
        "group": "Streaming"
    },
    {
        "key": "game_time_casual",
        "label": "Casual Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/c2844b37da74241525c1001c2ae5dd2719beb0095af8f88dcb35a37ceb0e1892.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_recreational",
        "label": "Recreational Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/157b789531c602542070e680c410d74275e796b6c45cd717292f6d2a59593972.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_dedicated",
        "label": "Dedicated Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/d6ab0696aae97fca8e6b2b88d4117f09f9ea895d4f0cebee770564369ff06873.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_committed",
        "label": "Committed Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/cc1edd8d955872cd9fbd9bafec80c973287817560d0895587686e3e1671a698e.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_serious",
        "label": "Serious Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/4039caeef586467d50939f3154f87828645d6f1bd699b8f0c1da686b02cefe68.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_devoted",
        "label": "Devoted Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/3d39b6cef7f00fe9e2d51f229034650b900481823af05d09e6537e912de30301.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_seasoned",
        "label": "Seasoned Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/46512ce94203c84d7919904acfbd07fc5a8316010a610b8fd6a1cc937e5ac75e.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_ironclad",
        "label": "Ironclad Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/9bff716e6bae2ef42dc959bac05a0dfc480bf89484c111ed7fb4aa0332cb22d8.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_unshakeable",
        "label": "Unshakeable Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/1f51d59934543176d8b585c4e5a62d77ca3677c6e26ae4da74b1b639f9091b5e.png",
        "group": "Game Time"
    },
    {
        "key": "game_time_eternal",
        "label": "Eternal Game Time",
        "icon": "https://cdn.discordapp.com/assets/content/8a62ba720addf7584d3e7f82170104e6a2b35aea4aba5ffc7260cfd706f40c37.png",
        "group": "Game Time"
    },
    {
        "key": "game_variety_sampler",
        "label": "Sampler Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/cbd75cae9bca1c49b35eb0d9c189af4c8604b4f69a1de17ae550db9f03cbd371.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_dabbler",
        "label": "Dabbler Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/c9fe2cefaf224c0fb73a5fe11476987930809fa307069deb8bbb2f0b99bac545.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_enthusiast",
        "label": "Enthusiast Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/e016406cec55df228f6e4e7ee9ec5ac10cf0ccd5037c5926da5c26c44e32d374.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_ranger",
        "label": "Ranger Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/7265bc6f9ff0a47962dafe01b6f9c8f75927392aaf48d48c3619d123d2b584f5.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_explorer",
        "label": "Explorer Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/ffd4938d41c57d27fec0f253a54756c40add56f761c5b1471b531d838e8669db.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_adventurer",
        "label": "Adventurer Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/dcfdce8dfc254b6e8fa9cfba5dcd918f027e27554c3aa2403fe01eb319cf2194.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_voyager",
        "label": "Voyager Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/183d6521c3696b0b42f73dd9c319307490982a5dffdc34a923b760d82b20916a.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_maverick",
        "label": "Maverick Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/84d4695cdcbb350ad5385c06e87caf06835872135625a8bff6bac300af858412.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_polymath",
        "label": "Polymath Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/1d8d9e3254727d1a1c01b194f2d01ade4525dc8b85c39b877af09768eaf031be.png",
        "group": "Game Variety"
    },
    {
        "key": "game_variety_universalist",
        "label": "Universalist Game Variety",
        "icon": "https://cdn.discordapp.com/assets/content/4731855cd51c1d45fd14dc088b80815ea0562a353b48db369092019fbcb44ec7.png",
        "group": "Game Variety"
    }
];
