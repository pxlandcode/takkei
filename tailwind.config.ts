const orange = '#dd890b';
//gray
const brightGray = '#FAFCFC';
const gray = '#D9D9D9';

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

//Almost black
const dark = '#252525';
const text = '#363636';

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
				green: {
					DEFAULT: green
				},
				gray: {
					DEFAULT: gray,
					bright: brightGray
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
					DEFAULT: dark
				}
			}
		}
	},
	plugins: []
};
