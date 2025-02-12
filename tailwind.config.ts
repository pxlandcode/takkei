const orange = '#dd890b';
const orangeDark = '#c47a0a';
//gray

//green
const green = '#29793D';

//bronze
const lightBronze = '#FFF6EE';
const bronze = '#AA8554';

//red
const lightRed = '#F4F6FF';
const red = '#c04c3d';
const darkRed = '#C0645F';

//blue
const lightBlue = '#F4F6FF';
const blue = '#3C82F6';

const takkeiBlack = '#000';
const takkeiWhite = '#fff';
const takkeiGray = '#3E3E3E';
const takkeiBrightGray = '#BEC0C1';

const mediumGray = '#808080';

const text = takkeiGray;
const primary = orange;
const primaryHover = orangeDark;

module.exports = {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./src/routes/**/*.{svelte,ts,js}',
		'./src/lib/**/*.{svelte,ts,js}'
	],
	theme: {
		extend: {
			fontFamily: {
				inter: ['Inter', 'san-serif']
			},
			colors: {
				orange: {
					DEFAULT: orange
				},
				primary: {
					DEFAULT: primary,
					hover: primaryHover
				},
				green: {
					DEFAULT: green
				},
				gray: {
					DEFAULT: takkeiGray,
					bright: takkeiBrightGray,
					medium: mediumGray
				},
				red: {
					DEFAULT: red,
					dark: darkRed,
					background: lightRed
				},
				blue: {
					DEFAULT: blue,
					background: lightBlue
				},
				text: {
					DEFAULT: text
				},
				bronze: {
					DEFAULT: bronze,
					light: lightBronze
				},
				black: {
					DEFAULT: takkeiBlack
				}
			},
			screens: {
				xs: '320px',
				sm: '640px',
				md: '768px',
				mm: '970px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1536px'
			},
			backgroundImage: {
				'background-gradient':
					'linear-gradient(349deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 79%, rgba(102,102,102,1) 100%);'
			}
		}
	},
	plugins: [
		function ({ addUtilities }) {
			addUtilities({
				'.glass': {
					'background-color': 'rgba(255, 255, 255, 0.24)',
					'backdrop-filter': 'blur(9px)',
					border: '1px solid rgba(255, 255, 250, 0.1)'
				},
				'.rounded-4xl': {
					'border-radius': '1.8rem'
				}
			});
		}
	]
};
