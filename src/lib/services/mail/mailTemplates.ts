import { randomInt } from 'crypto';

type EmailImage = {
	image: string;
};

const fallbackImages: EmailImage[] = [
	{
		image: 'https://takkei.netlify.app/images/neck.png'
	},
	{
		image: 'https://takkei.netlify.app/images/leaves.png'
	},
	{
		image: 'https://takkei.netlify.app/images/sand-wall.png'
	}
];

const fallbackFooterLines = [
	['En timme i veckan', 'Hela kroppen', 'Repetera'],
	['Kontinuitet är nyckeln till träningsframgång'],
	['Smärtfri', 'Smidig', 'Stark', 'Snabb', '(Snygg)']
];

function escapeHtml(raw: string): string {
	return raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function buildTakkeiEmail({
	subject,
	header,
	subheader,
	body,
	image = null,
	footerLines
}: {
	subject: string;
	header?: string | null;
	subheader?: string | null;
	body: string;
	image?: EmailImage | null;
	footerLines?: string[] | null;
}) {
	const selected = image ?? fallbackImages[randomInt(fallbackImages.length)];
	const resolvedFooterLines =
		footerLines === undefined
			? fallbackFooterLines[randomInt(fallbackFooterLines.length)]
			: footerLines;
	const footerMessageMarkup = resolvedFooterLines?.length
		? `<p style="margin: 0;">${resolvedFooterLines.map(escapeHtml).join(', ')}</p>`
		: '';
	const trimmedHeader = header?.trim() ?? '';
	const trimmedSubheader = subheader?.trim() ?? '';
	const documentTitle = trimmedHeader || subject;
	const headerMarkup = trimmedHeader
		? `<h1 style="font-family: Arial, sans-serif; font-size: 24px; margin: 0; color: #ffffff;">${trimmedHeader}</h1>`
		: '';
	const subheaderMarkup = trimmedSubheader
		? `<p style="font-family: Arial, sans-serif; font-size: 16px; margin: 8px 0 0 0; color: #dddddd;">${trimmedSubheader}</p>`
		: '';

	return `
	<!DOCTYPE html>
	<html lang="sv">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${documentTitle}</title>
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
								${headerMarkup}
								${subheaderMarkup}
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
								${footerMessageMarkup}
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
