const orange = '#dd890b';
const orangeDark = '#c47a0a';
//gray

//green
const brightGreen = '#33c759';
const green = '#24A691';
const darkGreen = '#061B15';

//bronze
const lightBronze = '#FFF6EE';
const bronze = '#AA8554';

//red
const lightRed = '#F4F6FF';
const brightRed = '#E87979';
const red = '#c04c3d';
const darkRed = '#C0645F';

//blue
const lightBlue = '#F4F6FF';
const blue = '#3C82F6';

const takkeiBlack = '#000';
const takkeiWhite = '#fff';
const takkeiGray = '#3E3E3E';
const takkeiBrightGray = '#BEC0C1';
const takkeiDarkGray = '#2B2B2B';

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
					DEFAULT: green,
					bright: brightGreen,
					dark: darkGreen
				},
				gray: {
					DEFAULT: takkeiGray,
					bright: takkeiBrightGray,
					medium: mediumGray,
					dark: takkeiDarkGray
				},
				red: {
					DEFAULT: red,
					dark: darkRed,
					background: lightRed,
					bright: brightRed
				},
				blue: {
					DEFAULT: blue,
					background: lightBlue
				},
				gold: {
					DEFAULT: '#FFD700'
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
				},
				error: {
					DEFAULT: red,
					hover: darkRed
				},
				success: {
					DEFAULT: green,
					hover: brightGreen
				},
				notification: {
					DEFAULT: brightRed
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
			},
			fontSize: {
				xxs: '0.6rem'
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
				'.hide-scrollbar': {
					'scrollbar-width': 'none',
					'-ms-overflow-style': 'none'
				},
				'.hide-scrollbar::-webkit-scrollbar': {
					display: 'none'
				},
				'.rounded-4xl': {
					'border-radius': '1.8rem'
				},
				'.custom-scrollbar': {
					'scrollbar-width': 'thin',
					'scrollbar-color': 'rgba(0, 0, 0, 0.2) transparent',
					'border-radius': 'inherit'
				},
				'.custom-scrollbar::-webkit-scrollbar': {
					width: '8px'
				},
				'.custom-scrollbar::-webkit-scrollbar-track': {
					background: 'transparent',
					'border-radius': '8px'
				},
				'.custom-scrollbar::-webkit-scrollbar-thumb': {
					background: 'rgba(0, 0, 0, 0.2)',
					'border-radius': '8px',
					transition: 'background 0.3s ease'
				},
				'.custom-scrollbar::-webkit-scrollbar-thumb:hover': {
					background: 'rgba(0, 0, 0, 0.3)'
				}
			});
		}
	]
};
