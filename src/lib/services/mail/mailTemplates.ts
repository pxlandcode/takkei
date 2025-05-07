import { randomInt } from 'crypto';

type EmailImage = {
	image: string;
	lines: string[];
};

const fallbackImages: EmailImage[] = [
	{
		image: 'https://takkei.netlify.app/images/neck.png',
		lines: ['En timme i veckan', 'Hela kroppen', 'Repetera']
	},
	{
		image: 'https://takkei.netlify.app/images/leaves.png',
		lines: ['Kontinuitet är nyckeln till träningsframgång']
	},
	{
		image: 'https://takkei.netlify.app/images/sand-wall.png',
		lines: ['Smärtfri', 'Smidig', 'Stark', 'Snabb', '(Snygg)']
	}
];

export function buildTakkeiEmail({
	header,
	subheader,
	body,
	image = null
}: {
	header: string;
	subheader: string;
	body: string;
	image?: EmailImage | null;
}) {
	const index = image ? -1 : randomInt(fallbackImages.length);
	console.log('index', index);
	const selected = image ?? fallbackImages[index];

	return `
	<!DOCTYPE html>
	<html lang="sv">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${header}</title>
	</head>
	<body style="margin:0; padding:0; background-color:#000000;" bgcolor="#000000">
		<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;" bgcolor="#000000">
			<tr>
				<td align="center">
					<table width="800" cellpadding="0" cellspacing="0" style="width:100%; max-width:800px; margin:0 auto;">
						<tr>
							<td align="left" style="padding: 24px;">
								<img src="https://takkei.netlify.app/images/takkei-logo.png" alt="Takkei logo" style="height: 60px; display: block;" />
							</td>
							<td align="right" style="padding: 24px; font-size: 0.9rem;">
								<a href="https://takkeitraining.com" style="color: #BEC0C1; text-decoration: none;">takkeitraining.com</a>
							</td>
						</tr>
						<tr>
							<td colspan="2" align="center" style="padding: 0 24px;">
								<img src="${selected.image}" alt="Takkei image" style="display: block; width: 100%; max-height: 150px; object-fit: cover; object-position: center top; border-radius: 12px;" />
							</td>
						</tr>
						<tr>
							<td colspan="2" align="center" style="padding: 24px;">
								<h1 style="font-family: Arial, sans-serif; font-size: 24px; margin: 0; color: #ffffff;">${header}</h1>
								<p style="font-family: Arial, sans-serif; font-size: 16px; margin: 8px 0 0 0; color: #dddddd;">${subheader}</p>
							</td>
						</tr>
						<tr>
							<td colspan="2" style="padding: 24px;">
								<div style="background-color: #ffffff; color: #000000; padding: 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; border-radius: 8px;">
									${body}
								</div>
							</td>
						</tr>
						<tr>
							<td colspan="2" style="padding: 32px 24px 16px 24px; text-align: center; background-color: #000000; color: #aaaaaa; font-family: Arial, sans-serif; font-size: 12px;">
								<p style="margin: 0;">${selected.lines.join(', ')}</p>
								<p style="margin: 8px 0 0 0;">Takkei</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
	</html>
	`;
}
