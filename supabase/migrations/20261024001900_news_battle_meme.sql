-- MemeMasters – News : nouveau nom « Battle Meme » et annonce du Battle Royale (2026-10-24).
-- Publiées au moment de l'application de la migration : tous les joueurs reçoivent la notification
-- des news (point rouge sur Infos). Textes dans les 7 langues du jeu.

insert into public.news (published_at, kind, title, body) values
(
  now() - interval '1 second',
  'change',
  jsonb_build_object(
    'fr', $t$Nouveau nom : Battle Meme$t$,
    'en', $t$New name: Battle Meme$t$,
    'es', $t$Nuevo nombre: Battle Meme$t$,
    'pt', $t$Novo nome: Battle Meme$t$,
    'de', $t$Neuer Name: Battle Meme$t$,
    'zh', $t$新名字：Battle Meme$t$,
    'ar', $t$اسم جديد: Battle Meme$t$
  ),
  jsonb_build_object(
    'fr', $t$MemeMasters s'appelle désormais Battle Meme. Ta collection, tes boosters, tes trophées et ta MemeMoney ne changent pas. L'accueil prend aussi les couleurs de ton thème, et la page Batailles devient Battle Royale.$t$,
    'en', $t$MemeMasters is now called Battle Meme. Your collection, boosters, trophies and MemeMoney stay the same. The home screen now follows your theme's colors, and the Battles page becomes Battle Royale.$t$,
    'es', $t$MemeMasters ahora se llama Battle Meme. Tu colección, tus sobres, tus trofeos y tu MemeMoney no cambian. El inicio sigue ahora los colores de tu tema, y la página Batallas pasa a llamarse Battle Royale.$t$,
    'pt', $t$MemeMasters agora se chama Battle Meme. Sua coleção, seus pacotes, seus troféus e sua MemeMoney não mudam. O início agora segue as cores do seu tema, e a página Batalhas passa a se chamar Battle Royale.$t$,
    'de', $t$MemeMasters heißt jetzt Battle Meme. Deine Sammlung, Booster, Trophäen und MemeMoney bleiben unverändert. Der Startbildschirm übernimmt jetzt die Farben deines Designs, und die Seite „Kämpfe“ heißt jetzt Battle Royale.$t$,
    'zh', $t$MemeMasters 现已更名为 Battle Meme。你的收藏、卡包、奖杯和 MemeMoney 都不变。主页现在会跟随你的主题配色，「对战」页面也改名为「大逃杀」。$t$,
    'ar', $t$أصبح اسم MemeMasters الآن Battle Meme. مجموعتك وحزمك وكؤوسك وMemeMoney لا تتغير. وتتبع الصفحة الرئيسية الآن ألوان مظهرك، وتصبح صفحة المعارك «باتل رويال».$t$
  )
),
(
  now(),
  'upcoming',
  jsonb_build_object(
    'fr', $t$Bientôt : le Battle Royale$t$,
    'en', $t$Coming soon: Battle Royale$t$,
    'es', $t$Próximamente: el Battle Royale$t$,
    'pt', $t$Em breve: o Battle Royale$t$,
    'de', $t$Bald: das Battle Royale$t$,
    'zh', $t$即将上线：大逃杀$t$,
    'ar', $t$قريبًا: الباتل رويال$t$
  ),
  jsonb_build_object(
    'fr', $t$Jusqu'à 100 participants, une zone qui se referme et des armes à ramasser : chaque carte devient un personnage jouable, avec ses avantages et ses inconvénients. Ta place finale te fera gagner ou perdre des trophées et te rapportera de la MemeMoney. Tout est expliqué dans Infos : Carte, Trophées, Rangs et MemeMoney.$t$,
    'en', $t$Up to 100 players, a closing zone and weapons to pick up: every card becomes a playable character, with its strengths and weaknesses. Your final place will win or lose you trophies and earn you MemeMoney. It's all explained in Info: Card, Trophies, Ranks and MemeMoney.$t$,
    'es', $t$Hasta 100 participantes, una zona que se cierra y armas para recoger: cada carta se convierte en un personaje jugable, con sus ventajas y sus inconvenientes. Tu puesto final te hará ganar o perder trofeos y te dará MemeMoney. Todo está explicado en Info: Carta, Trofeos, Rangos y MemeMoney.$t$,
    'pt', $t$Até 100 participantes, uma zona que se fecha e armas para recolher: cada carta vira um personagem jogável, com suas vantagens e desvantagens. Sua posição final vai fazer você ganhar ou perder troféus e render MemeMoney. Tudo está explicado em Info: Carta, Troféus, Ranques e MemeMoney.$t$,
    'de', $t$Bis zu 100 Teilnehmende, eine Zone, die sich schließt, und Waffen zum Aufheben: Jede Karte wird zu einer spielbaren Figur mit Stärken und Schwächen. Deine Endplatzierung bringt oder kostet Trophäen und bringt MemeMoney. Alles wird unter Infos erklärt: Karte, Trophäen, Ränge und MemeMoney.$t$,
    'zh', $t$最多 100 名参与者、不断缩小的安全区和可拾取的武器：每张卡牌都会变成可玩角色，各有优势与短板。你的最终名次决定奖杯的得失，还能获得 MemeMoney。详情请见「信息」：卡牌、奖杯、段位和 MemeMoney。$t$,
    'ar', $t$حتى 100 مشارك، ومنطقة تضيق، وأسلحة لالتقاطها: كل بطاقة تصبح شخصية قابلة للعب، لها مزاياها وعيوبها. مركزك النهائي سيكسبك كؤوسًا أو يُفقدك إياها ويمنحك MemeMoney. كل شيء مشروح في معلومات: البطاقة، الكؤوس، الرتب وMemeMoney.$t$
  )
);
