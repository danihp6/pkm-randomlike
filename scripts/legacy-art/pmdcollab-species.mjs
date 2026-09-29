// Shared id/slug/row list for every species with a real PMDCollab sprite
// pack fetched into sprite-sources/pokemons/<slug>-pmdcollab/ (see that
// folder's README section and scripts/fetch-pmdcollab.mjs). Consumed by
// scripts/extract-real-sprites.mjs (walk/attack/idle/hurt frames, one file
// pair per species — no longer atlas-row-based, see that script) and
// scripts/extract-real-portraits.mjs (portrait sheet, still one shared
// atlas keyed by `row`), which both key off the same `slug` to find each
// species' local source folder - a species only needs adding here once to
// be picked up by both.
//
// `row` is only meaningful to the portrait atlas now (row index = id - 1).
// `shootAnim` substitutes a different PMDCollab anim name for the
// special-attack sprite slot, for species with no "Shoot" anim of their own.
//
export const PMDCOLLAB_SPECIES = [
  { id: 1, slug: 'bulbasaur', row: 0 },
  { id: 2, slug: 'ivysaur', row: 1 },
  { id: 3, slug: 'venusaur', row: 2 },
  { id: 4, slug: 'charmander', row: 3 }, // 4-frame idle/walk, defaults fine
  { id: 5, slug: 'charmeleon', row: 4 },
  { id: 6, slug: 'charizard', row: 5 },
  { id: 7, slug: 'squirtle', row: 6 },
  { id: 8, slug: 'wartortle', row: 7 },
  { id: 9, slug: 'blastoise', row: 8 },
  { id: 10, slug: 'caterpie', row: 9 }, // 3-frame walk, defaults fine
  { id: 11, slug: 'metapod', row: 10 },
  { id: 12, slug: 'butterfree', row: 11 },
  { id: 13, slug: 'weedle', row: 12 },
  { id: 14, slug: 'kakuna', row: 13 },
  { id: 15, slug: 'beedrill', row: 14 }, // Idle is <CopyOf>Walk</CopyOf>
  { id: 16, slug: 'pidgey', row: 15 },
  { id: 17, slug: 'pidgeotto', row: 16 },
  { id: 18, slug: 'pidgeot', row: 17 },
  { id: 19, slug: 'rattata', row: 18 },
  { id: 20, slug: 'raticate', row: 19 },
  { id: 21, slug: 'spearow', row: 20 },
  { id: 22, slug: 'fearow', row: 21 },
  { id: 23, slug: 'ekans', row: 22 },
  { id: 24, slug: 'arbok', row: 23 },
  { id: 25, slug: 'pikachu', row: 24 },
  { id: 26, slug: 'raichu', row: 25 },
  { id: 27, slug: 'sandshrew', row: 26 },
  { id: 28, slug: 'sandslash', row: 27 },
  { id: 29, slug: 'nidoran-f', row: 28 },
  { id: 30, slug: 'nidorina', row: 29 },
  { id: 31, slug: 'nidoqueen', row: 30 },
  { id: 32, slug: 'nidoran-m', row: 31 },
  { id: 33, slug: 'nidorino', row: 32 },
  { id: 34, slug: 'nidoking', row: 33 },
  { id: 35, slug: 'clefairy', row: 34, shootAnim: 'Charge' }, // no Shoot anim on PMDCollab
  { id: 36, slug: 'clefable', row: 35, shootAnim: 'Charge' }, // no Shoot anim on PMDCollab
  { id: 37, slug: 'vulpix', row: 36 },
  { id: 38, slug: 'ninetales', row: 37 },
  { id: 39, slug: 'jigglypuff', row: 38 },
  { id: 40, slug: 'wigglytuff', row: 39 },
  { id: 41, slug: 'zubat', row: 40 },
  { id: 42, slug: 'golbat', row: 41 },
  { id: 43, slug: 'oddish', row: 42 },
  { id: 44, slug: 'gloom', row: 43 },
  { id: 45, slug: 'vileplume', row: 44 },
  { id: 46, slug: 'paras', row: 45 },
  { id: 47, slug: 'parasect', row: 46 },
  { id: 48, slug: 'venonat', row: 47 },
  { id: 49, slug: 'venomoth', row: 48 },
  { id: 50, slug: 'diglett', row: 49 },
  { id: 51, slug: 'dugtrio', row: 50 }, // 3-frame walk, defaults fine
  { id: 52, slug: 'meowth', row: 51 },
  { id: 53, slug: 'persian', row: 52 },
  { id: 54, slug: 'psyduck', row: 53 },
  { id: 55, slug: 'golduck', row: 54 },
  { id: 56, slug: 'mankey', row: 55 },
  { id: 57, slug: 'primeape', row: 56 },
  { id: 58, slug: 'growlithe', row: 57 },
  { id: 59, slug: 'arcanine', row: 58 },
  { id: 60, slug: 'poliwag', row: 59 },
  { id: 61, slug: 'poliwhirl', row: 60 },
  { id: 62, slug: 'poliwrath', row: 61 },
  { id: 63, slug: 'abra', row: 62 },
  { id: 64, slug: 'kadabra', row: 63 },
  { id: 65, slug: 'alakazam', row: 64 },
  { id: 66, slug: 'machop', row: 65 },
  { id: 67, slug: 'machoke', row: 66 },
  { id: 68, slug: 'machamp', row: 67 },
  { id: 69, slug: 'bellsprout', row: 68 },
  { id: 70, slug: 'weepinbell', row: 69 },
  { id: 71, slug: 'victreebel', row: 70 },
  { id: 72, slug: 'tentacool', row: 71 },
  { id: 73, slug: 'tentacruel', row: 72 },
  { id: 74, slug: 'geodude', row: 73 },
  { id: 75, slug: 'graveler', row: 74 },
  { id: 76, slug: 'golem', row: 75 },
  { id: 77, slug: 'ponyta', row: 76 },
  { id: 78, slug: 'rapidash', row: 77 },
  { id: 79, slug: 'slowpoke', row: 78 },
  { id: 80, slug: 'slowbro', row: 79 },
  { id: 81, slug: 'magnemite', row: 80 },
  { id: 82, slug: 'magneton', row: 81 },
  { id: 83, slug: 'farfetchd', row: 82 },
  { id: 84, slug: 'doduo', row: 83 },
  { id: 85, slug: 'dodrio', row: 84 },
  { id: 86, slug: 'seel', row: 85 },
  { id: 87, slug: 'dewgong', row: 86 },
  { id: 88, slug: 'grimer', row: 87 },
  { id: 89, slug: 'muk', row: 88 },
  { id: 90, slug: 'shellder', row: 89 },
  { id: 91, slug: 'cloyster', row: 90 },
  { id: 92, slug: 'gastly', row: 91 },
  { id: 93, slug: 'haunter', row: 92 },
  { id: 94, slug: 'gengar', row: 93 },
  { id: 95, slug: 'onix', row: 94 },
  { id: 96, slug: 'drowzee', row: 95 },
  { id: 97, slug: 'hypno', row: 96 },
  { id: 98, slug: 'krabby', row: 97 },
  { id: 99, slug: 'kingler', row: 98 },
  { id: 100, slug: 'voltorb', row: 99 },
  { id: 101, slug: 'electrode', row: 100 },
  { id: 102, slug: 'exeggcute', row: 101 },
  { id: 103, slug: 'exeggutor', row: 102 },
  { id: 104, slug: 'cubone', row: 103 },
  { id: 105, slug: 'marowak', row: 104 },
  { id: 106, slug: 'hitmonlee', row: 105 },
  { id: 107, slug: 'hitmonchan', row: 106 },
  { id: 108, slug: 'lickitung', row: 107 },
  { id: 109, slug: 'koffing', row: 108 },
  { id: 110, slug: 'weezing', row: 109 },
  { id: 111, slug: 'rhyhorn', row: 110 },
  { id: 112, slug: 'rhydon', row: 111 },
  { id: 113, slug: 'chansey', row: 112 },
  { id: 114, slug: 'tangela', row: 113 },
  { id: 115, slug: 'kangaskhan', row: 114 },
  { id: 116, slug: 'horsea', row: 115 },
  { id: 117, slug: 'seadra', row: 116 },
  { id: 118, slug: 'goldeen', row: 117 },
  { id: 119, slug: 'seaking', row: 118 },
  { id: 120, slug: 'staryu', row: 119 },
  { id: 121, slug: 'starmie', row: 120 },
  { id: 122, slug: 'mr-mime', row: 121 },
  { id: 123, slug: 'scyther', row: 122 },
  { id: 124, slug: 'jynx', row: 123 },
  { id: 125, slug: 'electabuzz', row: 124 },
  { id: 126, slug: 'magmar', row: 125 },
  { id: 127, slug: 'pinsir', row: 126 },
  { id: 128, slug: 'tauros', row: 127 },
  { id: 129, slug: 'magikarp', row: 128 },
  { id: 130, slug: 'gyarados', row: 129 },
  { id: 131, slug: 'lapras', row: 130 },
  { id: 132, slug: 'ditto', row: 131 },
  { id: 133, slug: 'eevee', row: 132 },
  { id: 134, slug: 'vaporeon', row: 133 },
  { id: 135, slug: 'jolteon', row: 134 },
  { id: 136, slug: 'flareon', row: 135 },
  { id: 137, slug: 'porygon', row: 136 },
  { id: 138, slug: 'omanyte', row: 137 },
  { id: 139, slug: 'omastar', row: 138 },
  { id: 140, slug: 'kabuto', row: 139 },
  { id: 141, slug: 'kabutops', row: 140 },
  { id: 142, slug: 'aerodactyl', row: 141 },
  { id: 143, slug: 'snorlax', row: 142 },
  { id: 144, slug: 'articuno', row: 143 },
  { id: 145, slug: 'zapdos', row: 144 },
  { id: 146, slug: 'moltres', row: 145 },
  { id: 147, slug: 'dratini', row: 146 },
  { id: 148, slug: 'dragonair', row: 147 }, // Idle is <CopyOf>Walk</CopyOf>
  { id: 149, slug: 'dragonite', row: 148 },
  { id: 150, slug: 'mewtwo', row: 149 },
  { id: 151, slug: 'mew', row: 150 },
  { id: 152, slug: 'chikorita', row: 151 },
  { id: 153, slug: 'bayleef', row: 152 },
  { id: 154, slug: 'meganium', row: 153 },
  { id: 155, slug: 'cyndaquil', row: 154 },
  { id: 156, slug: 'quilava', row: 155 },
  { id: 157, slug: 'typhlosion', row: 156 },
  { id: 158, slug: 'totodile', row: 157 },
  { id: 159, slug: 'croconaw', row: 158 },
  { id: 160, slug: 'feraligatr', row: 159 },
  { id: 161, slug: 'sentret', row: 160 },
  { id: 162, slug: 'furret', row: 161 },
  { id: 163, slug: 'hoothoot', row: 162 },
  { id: 164, slug: 'noctowl', row: 163 },
  { id: 165, slug: 'ledyba', row: 164 },
  { id: 166, slug: 'ledian', row: 165 },
  { id: 167, slug: 'spinarak', row: 166 },
  { id: 168, slug: 'ariados', row: 167 },
  { id: 169, slug: 'crobat', row: 168 },
  { id: 170, slug: 'chinchou', row: 169 },
  { id: 171, slug: 'lanturn', row: 170 },
  { id: 172, slug: 'pichu', row: 171, shootAnim: 'Charge' }, // no Shoot anim on PMDCollab
  { id: 173, slug: 'cleffa', row: 172 },
  { id: 174, slug: 'igglybuff', row: 173 },
  { id: 175, slug: 'togepi', row: 174, shootAnim: 'Charge' }, // no Shoot anim on PMDCollab
  { id: 176, slug: 'togetic', row: 175, shootAnim: 'Charge' }, // no Shoot anim on PMDCollab
  { id: 177, slug: 'natu', row: 176 },
  { id: 178, slug: 'xatu', row: 177 },
  { id: 179, slug: 'mareep', row: 178 },
  { id: 180, slug: 'flaaffy', row: 179 },
  { id: 181, slug: 'ampharos', row: 180 },
  { id: 182, slug: 'bellossom', row: 181 },
  { id: 183, slug: 'marill', row: 182 },
  { id: 184, slug: 'azumarill', row: 183 },
  { id: 185, slug: 'sudowoodo', row: 184 },
  { id: 186, slug: 'politoed', row: 185 },
  { id: 187, slug: 'hoppip', row: 186 },
  { id: 188, slug: 'skiploom', row: 187 },
  { id: 189, slug: 'jumpluff', row: 188 },
  { id: 190, slug: 'aipom', row: 189 },
  { id: 191, slug: 'sunkern', row: 190 },
  { id: 192, slug: 'sunflora', row: 191 },
  { id: 193, slug: 'yanma', row: 192 },
  { id: 194, slug: 'wooper', row: 193 },
  { id: 195, slug: 'quagsire', row: 194 },
  { id: 196, slug: 'espeon', row: 195 },
  { id: 197, slug: 'umbreon', row: 196 },
  { id: 198, slug: 'murkrow', row: 197 },
  { id: 199, slug: 'slowking', row: 198 },
  { id: 200, slug: 'misdreavus', row: 199 },
  { id: 201, slug: 'unown', row: 200 },
  { id: 202, slug: 'wobbuffet', row: 201 },
  { id: 203, slug: 'girafarig', row: 202 },
  { id: 204, slug: 'pineco', row: 203 },
  { id: 205, slug: 'forretress', row: 204 },
  { id: 206, slug: 'dunsparce', row: 205 },
  { id: 207, slug: 'gligar', row: 206 },
  { id: 208, slug: 'steelix', row: 207 },
  { id: 209, slug: 'snubbull', row: 208 },
  { id: 210, slug: 'granbull', row: 209 },
  { id: 211, slug: 'qwilfish', row: 210 },
  { id: 212, slug: 'scizor', row: 211 },
  { id: 213, slug: 'shuckle', row: 212 },
  { id: 214, slug: 'heracross', row: 213 },
  { id: 215, slug: 'sneasel', row: 214 },
  { id: 216, slug: 'teddiursa', row: 215 },
  { id: 217, slug: 'ursaring', row: 216 },
  { id: 218, slug: 'slugma', row: 217 },
  { id: 219, slug: 'magcargo', row: 218 },
  { id: 220, slug: 'swinub', row: 219 },
  { id: 221, slug: 'piloswine', row: 220 },
  { id: 222, slug: 'corsola', row: 221 },
  { id: 223, slug: 'remoraid', row: 222 },
  { id: 224, slug: 'octillery', row: 223 },
  { id: 225, slug: 'delibird', row: 224 },
  { id: 226, slug: 'mantine', row: 225 },
  { id: 227, slug: 'skarmory', row: 226 },
  { id: 228, slug: 'houndour', row: 227 },
  { id: 229, slug: 'houndoom', row: 228 },
  { id: 230, slug: 'kingdra', row: 229 },
  { id: 231, slug: 'phanpy', row: 230 },
  { id: 232, slug: 'donphan', row: 231 },
  { id: 233, slug: 'porygon2', row: 232 },
  { id: 234, slug: 'stantler', row: 233 },
  { id: 235, slug: 'smeargle', row: 234 },
  { id: 236, slug: 'tyrogue', row: 235 },
  { id: 237, slug: 'hitmontop', row: 236 },
  { id: 238, slug: 'smoochum', row: 237 },
  { id: 239, slug: 'elekid', row: 238 },
  { id: 240, slug: 'magby', row: 239 },
  { id: 241, slug: 'miltank', row: 240 },
  { id: 242, slug: 'blissey', row: 241 },
  { id: 243, slug: 'raikou', row: 242 },
  { id: 244, slug: 'entei', row: 243 },
  { id: 245, slug: 'suicune', row: 244 },
  { id: 246, slug: 'larvitar', row: 245 },
  { id: 247, slug: 'pupitar', row: 246 },
  { id: 248, slug: 'tyranitar', row: 247 },
  { id: 249, slug: 'lugia', row: 248 },
  { id: 250, slug: 'ho-oh', row: 249 },
  { id: 251, slug: 'celebi', row: 250 },
  // Gen 3 (Treecko-Deoxys): fetched by numeric National-Dex id rather than
  // name slug (node scripts/fetch-pmdcollab.mjs 252-386 --anims=...), so
  // slug here is the zero-padded id instead of a species name.
  { id: 252, slug: '0252', row: 251 }, // Treecko
  { id: 253, slug: '0253', row: 252 }, // Grovyle
  { id: 254, slug: '0254', row: 253 }, // Sceptile
  { id: 255, slug: '0255', row: 254 }, // Torchic
  { id: 256, slug: '0256', row: 255 }, // Combusken
  { id: 257, slug: '0257', row: 256 }, // Blaziken
  { id: 258, slug: '0258', row: 257 }, // Mudkip
  { id: 259, slug: '0259', row: 258 }, // Marshtomp
  { id: 260, slug: '0260', row: 259 }, // Swampert
  { id: 261, slug: '0261', row: 260 }, // Poochyena
  { id: 262, slug: '0262', row: 261 }, // Mightyena
  { id: 263, slug: '0263', row: 262 }, // Zigzagoon
  { id: 264, slug: '0264', row: 263 }, // Linoone
  { id: 265, slug: '0265', row: 264 }, // Wurmple
  { id: 266, slug: '0266', row: 265 }, // Silcoon
  { id: 267, slug: '0267', row: 266 }, // Beautifly
  { id: 268, slug: '0268', row: 267 }, // Cascoon
  { id: 269, slug: '0269', row: 268 }, // Dustox
  { id: 270, slug: '0270', row: 269 }, // Lotad
  { id: 271, slug: '0271', row: 270 }, // Lombre
  { id: 272, slug: '0272', row: 271 }, // Ludicolo
  { id: 273, slug: '0273', row: 272 }, // Seedot
  { id: 274, slug: '0274', row: 273 }, // Nuzleaf
  { id: 275, slug: '0275', row: 274 }, // Shiftry
  { id: 276, slug: '0276', row: 275 }, // Taillow
  { id: 277, slug: '0277', row: 276 }, // Swellow
  { id: 278, slug: '0278', row: 277 }, // Wingull
  { id: 279, slug: '0279', row: 278 }, // Pelipper
  { id: 280, slug: '0280', row: 279 }, // Ralts
  { id: 281, slug: '0281', row: 280 }, // Kirlia
  { id: 282, slug: '0282', row: 281 }, // Gardevoir
  { id: 283, slug: '0283', row: 282 }, // Surskit
  { id: 284, slug: '0284', row: 283 }, // Masquerain
  { id: 285, slug: '0285', row: 284 }, // Shroomish
  { id: 286, slug: '0286', row: 285 }, // Breloom
  { id: 287, slug: '0287', row: 286 }, // Slakoth
  { id: 288, slug: '0288', row: 287 }, // Vigoroth
  { id: 289, slug: '0289', row: 288 }, // Slaking
  { id: 290, slug: '0290', row: 289 }, // Nincada
  { id: 291, slug: '0291', row: 290 }, // Ninjask
  { id: 292, slug: '0292', row: 291 }, // Shedinja
  { id: 293, slug: '0293', row: 292 }, // Whismur
  { id: 294, slug: '0294', row: 293 }, // Loudred
  { id: 295, slug: '0295', row: 294 }, // Exploud
  { id: 296, slug: '0296', row: 295 }, // Makuhita
  { id: 297, slug: '0297', row: 296 }, // Hariyama
  { id: 298, slug: '0298', row: 297 }, // Azurill
  { id: 299, slug: '0299', row: 298 }, // Nosepass
  { id: 300, slug: '0300', row: 299 }, // Skitty
  { id: 301, slug: '0301', row: 300 }, // Delcatty
  { id: 302, slug: '0302', row: 301 }, // Sableye
  { id: 303, slug: '0303', row: 302 }, // Mawile
  { id: 304, slug: '0304', row: 303 }, // Aron
  { id: 305, slug: '0305', row: 304 }, // Lairon
  { id: 306, slug: '0306', row: 305 }, // Aggron
  { id: 307, slug: '0307', row: 306 }, // Meditite
  { id: 308, slug: '0308', row: 307 }, // Medicham
  { id: 309, slug: '0309', row: 308 }, // Electrike
  { id: 310, slug: '0310', row: 309 }, // Manectric
  { id: 311, slug: '0311', row: 310 }, // Plusle
  { id: 312, slug: '0312', row: 311 }, // Minun
  { id: 313, slug: '0313', row: 312 }, // Volbeat
  { id: 314, slug: '0314', row: 313 }, // Illumise
  { id: 315, slug: '0315', row: 314 }, // Roselia
  { id: 316, slug: '0316', row: 315 }, // Gulpin
  { id: 317, slug: '0317', row: 316 }, // Swalot
  { id: 318, slug: '0318', row: 317 }, // Carvanha
  { id: 319, slug: '0319', row: 318 }, // Sharpedo
  { id: 320, slug: '0320', row: 319 }, // Wailmer
  { id: 321, slug: '0321', row: 320 }, // Wailord
  { id: 322, slug: '0322', row: 321 }, // Numel
  { id: 323, slug: '0323', row: 322 }, // Camerupt
  { id: 324, slug: '0324', row: 323 }, // Torkoal
  { id: 325, slug: '0325', row: 324 }, // Spoink
  { id: 326, slug: '0326', row: 325 }, // Grumpig
  { id: 327, slug: '0327', row: 326 }, // Spinda
  { id: 328, slug: '0328', row: 327 }, // Trapinch
  { id: 329, slug: '0329', row: 328 }, // Vibrava
  { id: 330, slug: '0330', row: 329 }, // Flygon
  { id: 331, slug: '0331', row: 330 }, // Cacnea
  { id: 332, slug: '0332', row: 331 }, // Cacturne
  { id: 333, slug: '0333', row: 332 }, // Swablu
  { id: 334, slug: '0334', row: 333 }, // Altaria
  { id: 335, slug: '0335', row: 334 }, // Zangoose
  { id: 336, slug: '0336', row: 335 }, // Seviper
  { id: 337, slug: '0337', row: 336 }, // Lunatone
  { id: 338, slug: '0338', row: 337 }, // Solrock
  { id: 339, slug: '0339', row: 338 }, // Barboach
  { id: 340, slug: '0340', row: 339 }, // Whiscash
  { id: 341, slug: '0341', row: 340 }, // Corphish
  { id: 342, slug: '0342', row: 341 }, // Crawdaunt
  { id: 343, slug: '0343', row: 342 }, // Baltoy
  { id: 344, slug: '0344', row: 343 }, // Claydol
  { id: 345, slug: '0345', row: 344 }, // Lileep
  { id: 346, slug: '0346', row: 345 }, // Cradily
  { id: 347, slug: '0347', row: 346 }, // Anorith
  { id: 348, slug: '0348', row: 347 }, // Armaldo
  { id: 349, slug: '0349', row: 348 }, // Feebas
  { id: 350, slug: '0350', row: 349 }, // Milotic
  { id: 351, slug: '0351', row: 350 }, // Castform
  { id: 352, slug: '0352', row: 351 }, // Kecleon
  { id: 353, slug: '0353', row: 352 }, // Shuppet
  { id: 354, slug: '0354', row: 353 }, // Banette
  { id: 355, slug: '0355', row: 354 }, // Duskull
  { id: 356, slug: '0356', row: 355 }, // Dusclops
  { id: 357, slug: '0357', row: 356 }, // Tropius
  { id: 358, slug: '0358', row: 357 }, // Chimecho
  { id: 359, slug: '0359', row: 358 }, // Absol
  { id: 360, slug: '0360', row: 359 }, // Wynaut
  { id: 361, slug: '0361', row: 360 }, // Snorunt
  { id: 362, slug: '0362', row: 361 }, // Glalie
  { id: 363, slug: '0363', row: 362 }, // Spheal
  { id: 364, slug: '0364', row: 363 }, // Sealeo
  { id: 365, slug: '0365', row: 364 }, // Walrein
  { id: 366, slug: '0366', row: 365 }, // Clamperl
  { id: 367, slug: '0367', row: 366 }, // Huntail
  { id: 368, slug: '0368', row: 367 }, // Gorebyss
  { id: 369, slug: '0369', row: 368 }, // Relicanth
  { id: 370, slug: '0370', row: 369 }, // Luvdisc
  { id: 371, slug: '0371', row: 370 }, // Bagon
  { id: 372, slug: '0372', row: 371 }, // Shelgon
  { id: 373, slug: '0373', row: 372 }, // Salamence
  { id: 374, slug: '0374', row: 373 }, // Beldum
  { id: 375, slug: '0375', row: 374 }, // Metang
  { id: 376, slug: '0376', row: 375 }, // Metagross
  { id: 377, slug: '0377', row: 376 }, // Regirock
  { id: 378, slug: '0378', row: 377 }, // Regice
  { id: 379, slug: '0379', row: 378 }, // Registeel
  { id: 380, slug: '0380', row: 379 }, // Latias
  { id: 381, slug: '0381', row: 380 }, // Latios
  { id: 382, slug: '0382', row: 381 }, // Kyogre
  { id: 383, slug: '0383', row: 382 }, // Groudon
  { id: 384, slug: '0384', row: 383 }, // Rayquaza
  { id: 385, slug: '0385', row: 384 }, // Jirachi
  { id: 386, slug: '0386', row: 385 }, // Deoxys
  // Gen 4 (Turtwig-Arceus): fetched by numeric National-Dex id, same as gen 3.
  { id: 387, slug: '0387', row: 386 }, // Turtwig
  { id: 388, slug: '0388', row: 387 }, // Grotle
  { id: 389, slug: '0389', row: 388 }, // Torterra
  { id: 390, slug: '0390', row: 389 }, // Chimchar
  { id: 391, slug: '0391', row: 390 }, // Monferno
  { id: 392, slug: '0392', row: 391 }, // Infernape
  { id: 393, slug: '0393', row: 392 }, // Piplup
  { id: 394, slug: '0394', row: 393 }, // Prinplup
  { id: 395, slug: '0395', row: 394 }, // Empoleon
  { id: 396, slug: '0396', row: 395 }, // Starly
  { id: 397, slug: '0397', row: 396 }, // Staravia
  { id: 398, slug: '0398', row: 397 }, // Staraptor
  { id: 399, slug: '0399', row: 398 }, // Bidoof
  { id: 400, slug: '0400', row: 399 }, // Bibarel
  { id: 401, slug: '0401', row: 400 }, // Kricketot
  { id: 402, slug: '0402', row: 401 }, // Kricketune
  { id: 403, slug: '0403', row: 402 }, // Shinx
  { id: 404, slug: '0404', row: 403 }, // Luxio
  { id: 405, slug: '0405', row: 404 }, // Luxray
  { id: 406, slug: '0406', row: 405 }, // Budew
  { id: 407, slug: '0407', row: 406 }, // Roserade
  { id: 408, slug: '0408', row: 407 }, // Cranidos
  { id: 409, slug: '0409', row: 408 }, // Rampardos
  { id: 410, slug: '0410', row: 409 }, // Shieldon
  { id: 411, slug: '0411', row: 410 }, // Bastiodon
  { id: 412, slug: '0412', row: 411 }, // Burmy
  { id: 413, slug: '0413', row: 412 }, // Wormadam
  { id: 414, slug: '0414', row: 413 }, // Mothim
  { id: 415, slug: '0415', row: 414 }, // Combee
  { id: 416, slug: '0416', row: 415 }, // Vespiquen
  { id: 417, slug: '0417', row: 416 }, // Pachirisu
  { id: 418, slug: '0418', row: 417 }, // Buizel
  { id: 419, slug: '0419', row: 418 }, // Floatzel
  { id: 420, slug: '0420', row: 419 }, // Cherubi
  { id: 421, slug: '0421', row: 420 }, // Cherrim
  { id: 422, slug: '0422', row: 421 }, // Shellos
  { id: 423, slug: '0423', row: 422 }, // Gastrodon
  { id: 424, slug: '0424', row: 423 }, // Ambipom
  { id: 425, slug: '0425', row: 424 }, // Drifloon
  { id: 426, slug: '0426', row: 425 }, // Drifblim
  { id: 427, slug: '0427', row: 426 }, // Buneary
  { id: 428, slug: '0428', row: 427 }, // Lopunny
  { id: 429, slug: '0429', row: 428 }, // Mismagius
  { id: 430, slug: '0430', row: 429 }, // Honchkrow
  { id: 431, slug: '0431', row: 430 }, // Glameow
  { id: 432, slug: '0432', row: 431 }, // Purugly
  { id: 433, slug: '0433', row: 432 }, // Chingling
  { id: 434, slug: '0434', row: 433 }, // Stunky
  { id: 435, slug: '0435', row: 434 }, // Skuntank
  { id: 436, slug: '0436', row: 435 }, // Bronzor
  { id: 437, slug: '0437', row: 436 }, // Bronzong
  { id: 438, slug: '0438', row: 437 }, // Bonsly
  { id: 439, slug: '0439', row: 438 }, // Mime Jr.
  { id: 440, slug: '0440', row: 439 }, // Happiny
  { id: 441, slug: '0441', row: 440 }, // Chatot
  { id: 442, slug: '0442', row: 441 }, // Spiritomb
  { id: 443, slug: '0443', row: 442 }, // Gible
  { id: 444, slug: '0444', row: 443 }, // Gabite
  { id: 445, slug: '0445', row: 444 }, // Garchomp
  { id: 446, slug: '0446', row: 445 }, // Munchlax
  { id: 447, slug: '0447', row: 446, shootAnim: 'SpAttack' }, // Riolu, Shoot -> SpAttack (CopyOf RearUp)
  { id: 448, slug: '0448', row: 447, shootAnim: 'SpAttack' }, // Lucario, Shoot -> SpAttack (CopyOf RearUp)
  { id: 449, slug: '0449', row: 448 }, // Hippopotas
  { id: 450, slug: '0450', row: 449 }, // Hippowdon
  { id: 451, slug: '0451', row: 450 }, // Skorupi
  { id: 452, slug: '0452', row: 451 }, // Drapion
  { id: 453, slug: '0453', row: 452 }, // Croagunk
  { id: 454, slug: '0454', row: 453 }, // Toxicroak
  { id: 455, slug: '0455', row: 454 }, // Carnivine
  { id: 456, slug: '0456', row: 455 }, // Finneon
  { id: 457, slug: '0457', row: 456 }, // Lumineon
  { id: 458, slug: '0458', row: 457 }, // Mantyke
  { id: 459, slug: '0459', row: 458 }, // Snover
  { id: 460, slug: '0460', row: 459 }, // Abomasnow
  { id: 461, slug: '0461', row: 460 }, // Weavile
  { id: 462, slug: '0462', row: 461 }, // Magnezone
  { id: 463, slug: '0463', row: 462 }, // Lickilicky
  { id: 464, slug: '0464', row: 463 }, // Rhyperior
  { id: 465, slug: '0465', row: 464 }, // Tangrowth
  { id: 466, slug: '0466', row: 465 }, // Electivire
  { id: 467, slug: '0467', row: 466 }, // Magmortar
  { id: 468, slug: '0468', row: 467 }, // Togekiss
  { id: 469, slug: '0469', row: 468 }, // Yanmega
  { id: 470, slug: '0470', row: 469 }, // Leafeon
  { id: 471, slug: '0471', row: 470 }, // Glaceon
  { id: 472, slug: '0472', row: 471 }, // Gliscor
  { id: 473, slug: '0473', row: 472 }, // Mamoswine
  { id: 474, slug: '0474', row: 473 }, // Porygon-Z
  { id: 475, slug: '0475', row: 474 }, // Gallade
  { id: 476, slug: '0476', row: 475 }, // Probopass
  { id: 477, slug: '0477', row: 476 }, // Dusknoir
  { id: 478, slug: '0478', row: 477 }, // Froslass
  { id: 479, slug: '0479', row: 478 }, // Rotom
  { id: 480, slug: '0480', row: 479 }, // Uxie
  { id: 481, slug: '0481', row: 480 }, // Mesprit
  { id: 482, slug: '0482', row: 481 }, // Azelf
  { id: 483, slug: '0483', row: 482 }, // Dialga
  { id: 484, slug: '0484', row: 483 }, // Palkia
  { id: 485, slug: '0485', row: 484 }, // Heatran
  { id: 486, slug: '0486', row: 485 }, // Regigigas
  { id: 487, slug: '0487', row: 486 }, // Giratina
  { id: 488, slug: '0488', row: 487 }, // Cresselia
  { id: 489, slug: '0489', row: 488 }, // Phione
  { id: 490, slug: '0490', row: 489 }, // Manaphy
  { id: 491, slug: '0491', row: 490 }, // Darkrai
  { id: 492, slug: '0492', row: 491 }, // Shaymin
  { id: 493, slug: '0493', row: 492 }, // Arceus
  { id: 494, slug: '0494', row: 493 }, // Victini
  { id: 495, slug: '0495', row: 494 }, // Snivy
  { id: 496, slug: '0496', row: 495 }, // Servine
  { id: 497, slug: '0497', row: 496 }, // Serperior
  { id: 498, slug: '0498', row: 497 }, // Tepig
  { id: 499, slug: '0499', row: 498 }, // Pignite
  { id: 500, slug: '0500', row: 499 }, // Emboar
  { id: 501, slug: '0501', row: 500 }, // Oshawott
  { id: 502, slug: '0502', row: 501 }, // Dewott
  { id: 503, slug: '0503', row: 502 }, // Samurott
  { id: 504, slug: '0504', row: 503 }, // Patrat
  { id: 505, slug: '0505', row: 504 }, // Watchog
  { id: 506, slug: '0506', row: 505 }, // Lillipup
  { id: 507, slug: '0507', row: 506 }, // Herdier
  { id: 508, slug: '0508', row: 507 }, // Stoutland
  { id: 509, slug: '0509', row: 508 }, // Purrloin
  { id: 510, slug: '0510', row: 509 }, // Liepard
  { id: 511, slug: '0511', row: 510 }, // Pansage
  { id: 512, slug: '0512', row: 511 }, // Simisage
  { id: 513, slug: '0513', row: 512 }, // Pansear
  { id: 514, slug: '0514', row: 513 }, // Simisear
  { id: 515, slug: '0515', row: 514 }, // Panpour
  { id: 516, slug: '0516', row: 515 }, // Simipour
  { id: 517, slug: '0517', row: 516 }, // Munna
  { id: 518, slug: '0518', row: 517 }, // Musharna
  { id: 519, slug: '0519', row: 518 }, // Pidove
  { id: 520, slug: '0520', row: 519 }, // Tranquill
  { id: 521, slug: '0521', row: 520 }, // Unfezant
  { id: 522, slug: '0522', row: 521 }, // Blitzle
  { id: 523, slug: '0523', row: 522 }, // Zebstrika
  { id: 524, slug: '0524', row: 523 }, // Roggenrola
  { id: 525, slug: '0525', row: 524 }, // Boldore
  { id: 526, slug: '0526', row: 525 }, // Gigalith
  { id: 527, slug: '0527', row: 526 }, // Woobat
  { id: 528, slug: '0528', row: 527 }, // Swoobat
  { id: 529, slug: '0529', row: 528 }, // Drilbur
  { id: 530, slug: '0530', row: 529 }, // Excadrill
  { id: 531, slug: '0531', row: 530 }, // Audino
  { id: 532, slug: '0532', row: 531, shootAnim: 'Charge' }, // Timburr, no Shoot anim on PMDCollab
  { id: 533, slug: '0533', row: 532 }, // Gurdurr
  { id: 534, slug: '0534', row: 533 }, // Conkeldurr
  { id: 535, slug: '0535', row: 534 }, // Tympole
  { id: 536, slug: '0536', row: 535 }, // Palpitoad
  { id: 537, slug: '0537', row: 536 }, // Seismitoad
  { id: 538, slug: '0538', row: 537 }, // Throh
  { id: 539, slug: '0539', row: 538 }, // Sawk
  { id: 540, slug: '0540', row: 539 }, // Sewaddle
  { id: 541, slug: '0541', row: 540 }, // Swadloon
  { id: 542, slug: '0542', row: 541 }, // Leavanny
  { id: 543, slug: '0543', row: 542 }, // Venipede
  { id: 544, slug: '0544', row: 543 }, // Whirlipede
  { id: 545, slug: '0545', row: 544 }, // Scolipede
  { id: 546, slug: '0546', row: 545 }, // Cottonee
  { id: 547, slug: '0547', row: 546 }, // Whimsicott
  { id: 548, slug: '0548', row: 547 }, // Petilil
  { id: 549, slug: '0549', row: 548 }, // Lilligant
  { id: 550, slug: '0550', row: 549 }, // Basculin
  { id: 551, slug: '0551', row: 550 }, // Sandile
  { id: 552, slug: '0552', row: 551 }, // Krokorok
  { id: 553, slug: '0553', row: 552 }, // Krookodile
  { id: 554, slug: '0554', row: 553, shootAnim: 'Charge' }, // Darumaka, no Shoot anim on PMDCollab
  { id: 555, slug: '0555', row: 554 }, // Darmanitan
  { id: 556, slug: '0556', row: 555 }, // Maractus
  { id: 557, slug: '0557', row: 556 }, // Dwebble
  { id: 558, slug: '0558', row: 557 }, // Crustle
  { id: 559, slug: '0559', row: 558 }, // Scraggy
  { id: 560, slug: '0560', row: 559 }, // Scrafty
  { id: 561, slug: '0561', row: 560 }, // Sigilyph
  { id: 562, slug: '0562', row: 561 }, // Yamask
  { id: 563, slug: '0563', row: 562 }, // Cofagrigus
  { id: 564, slug: '0564', row: 563 }, // Tirtouga
  { id: 565, slug: '0565', row: 564 }, // Carracosta
  { id: 566, slug: '0566', row: 565 }, // Archen
  { id: 567, slug: '0567', row: 566 }, // Archeops
  { id: 568, slug: '0568', row: 567 }, // Trubbish
  { id: 569, slug: '0569', row: 568 }, // Garbodor
  { id: 570, slug: '0570', row: 569 }, // Zorua
  { id: 571, slug: '0571', row: 570 }, // Zoroark
  { id: 572, slug: '0572', row: 571, shootAnim: 'Charge' }, // Minccino, no Shoot anim on PMDCollab
  { id: 573, slug: '0573', row: 572 }, // Cinccino
  { id: 574, slug: '0574', row: 573 }, // Gothita
  { id: 575, slug: '0575', row: 574 }, // Gothorita
  { id: 576, slug: '0576', row: 575 }, // Gothitelle
  { id: 577, slug: '0577', row: 576 }, // Solosis
  { id: 578, slug: '0578', row: 577 }, // Duosion
  { id: 579, slug: '0579', row: 578 }, // Reuniclus
  { id: 580, slug: '0580', row: 579 }, // Ducklett
  { id: 581, slug: '0581', row: 580 }, // Swanna
  { id: 582, slug: '0582', row: 581 }, // Vanillite
  { id: 583, slug: '0583', row: 582 }, // Vanillish
  { id: 584, slug: '0584', row: 583 }, // Vanilluxe
  { id: 585, slug: '0585', row: 584 }, // Deerling
  { id: 586, slug: '0586', row: 585 }, // Sawsbuck
  { id: 587, slug: '0587', row: 586 }, // Emolga
  { id: 588, slug: '0588', row: 587 }, // Karrablast
  { id: 589, slug: '0589', row: 588 }, // Escavalier
  { id: 590, slug: '0590', row: 589 }, // Foongus
  { id: 591, slug: '0591', row: 590 }, // Amoonguss
  { id: 592, slug: '0592', row: 591 }, // Frillish
  { id: 594, slug: '0594', row: 593 }, // Alomomola
  { id: 595, slug: '0595', row: 594 }, // Joltik
  { id: 596, slug: '0596', row: 595 }, // Galvantula
  { id: 597, slug: '0597', row: 596 }, // Ferroseed
  { id: 598, slug: '0598', row: 597 }, // Ferrothorn
  { id: 599, slug: '0599', row: 598 }, // Klink
  { id: 600, slug: '0600', row: 599 }, // Klang
  { id: 601, slug: '0601', row: 600 }, // Klinklang
  { id: 602, slug: '0602', row: 601 }, // Tynamo
  { id: 603, slug: '0603', row: 602 }, // Eelektrik
  { id: 604, slug: '0604', row: 603 }, // Eelektross
  { id: 605, slug: '0605', row: 604 }, // Elgyem
  { id: 606, slug: '0606', row: 605 }, // Beheeyem
  { id: 607, slug: '0607', row: 606 }, // Litwick
  { id: 608, slug: '0608', row: 607 }, // Lampent
  { id: 609, slug: '0609', row: 608 }, // Chandelure
  { id: 610, slug: '0610', row: 609 }, // Axew
  { id: 611, slug: '0611', row: 610 }, // Fraxure
  { id: 612, slug: '0612', row: 611 }, // Haxorus
  { id: 613, slug: '0613', row: 612 }, // Cubchoo
  { id: 614, slug: '0614', row: 613 }, // Beartic
  { id: 615, slug: '0615', row: 614 }, // Cryogonal
  { id: 616, slug: '0616', row: 615 }, // Shelmet
  { id: 617, slug: '0617', row: 616 }, // Accelgor
  { id: 619, slug: '0619', row: 618, shootAnim: 'Charge' }, // Mienfoo, no Shoot anim on PMDCollab
  { id: 620, slug: '0620', row: 619 }, // Mienshao
  { id: 621, slug: '0621', row: 620 }, // Druddigon
  { id: 622, slug: '0622', row: 621 }, // Golett
  { id: 623, slug: '0623', row: 622 }, // Golurk
  { id: 624, slug: '0624', row: 623 }, // Pawniard
  { id: 625, slug: '0625', row: 624 }, // Bisharp
  { id: 626, slug: '0626', row: 625 }, // Bouffalant
  { id: 627, slug: '0627', row: 626 }, // Rufflet
  { id: 628, slug: '0628', row: 627 }, // Braviary
  { id: 629, slug: '0629', row: 628 }, // Vullaby
  { id: 630, slug: '0630', row: 629 }, // Mandibuzz
  { id: 631, slug: '0631', row: 630 }, // Heatmor
  { id: 632, slug: '0632', row: 631 }, // Durant
  { id: 633, slug: '0633', row: 632 }, // Deino
  { id: 634, slug: '0634', row: 633 }, // Zweilous
  { id: 635, slug: '0635', row: 634 }, // Hydreigon
  { id: 636, slug: '0636', row: 635 }, // Larvesta
  { id: 637, slug: '0637', row: 636 }, // Volcarona
  { id: 638, slug: '0638', row: 637 }, // Cobalion
  { id: 639, slug: '0639', row: 638 }, // Terrakion
  { id: 640, slug: '0640', row: 639 }, // Virizion
  { id: 641, slug: '0641', row: 640 }, // Tornadus
  { id: 642, slug: '0642', row: 641 }, // Thundurus
  { id: 643, slug: '0643', row: 642 }, // Reshiram
  { id: 644, slug: '0644', row: 643 }, // Zekrom
  { id: 645, slug: '0645', row: 644 }, // Landorus
  { id: 646, slug: '0646', row: 645 }, // Kyurem
  { id: 647, slug: '0647', row: 646 }, // Keldeo
  { id: 648, slug: '0648', row: 647 }, // Meloetta
  { id: 649, slug: '0649', row: 648 }, // Genesect

  // Castform's Forecast forms (see abilities.ts) - cosmetic-only alternate
  // sprites, keyed by synthetic id (base dex id * 100 + PMDCollab form
  // index) rather than a real dex id, since Forecast never changes species.
  // No portrait pack fetched for these (row unused, see extract-real-
  // portraits.mjs's existsSync skip) - only the overworld sprite matters.
  { id: 35101, slug: '0351-sunny', row: -1 }, // Castform (Sunny Form)
  { id: 35102, slug: '0351-rainy', row: -1 }, // Castform (Rainy Form)
  { id: 35103, slug: '0351-snowy', row: -1 }, // Castform (Snowy Form)
]
