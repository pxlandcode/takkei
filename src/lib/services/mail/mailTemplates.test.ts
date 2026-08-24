import { describe, expect, it } from 'vitest';
import { buildTakkeiEmail } from './mailTemplates';

describe('mailTemplates', () => {
	it('renders provided email footer lines', () => {
		const html = buildTakkeiEmail({
			subject: 'Test',
			body: 'Body',
			footerLines: ['Rad 1', 'Rad 2']
		});

		expect(html).toContain('Rad 1, Rad 2');
		expect(html).toContain('Takkei');
	});

	it('escapes provided email footer lines', () => {
		const html = buildTakkeiEmail({
			subject: 'Test',
			body: 'Body',
			footerLines: ['<script>alert("x")</script>']
		});

		expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
		expect(html).not.toContain('<script>alert("x")</script>');
	});

	it('omits the footer slogan when footer lines are null', () => {
		const html = buildTakkeiEmail({
			subject: 'Test',
			body: 'Body',
			footerLines: null
		});

		expect(html).not.toContain('En timme i veckan');
		expect(html).not.toContain('Kontinuitet är nyckeln');
		expect(html).not.toContain('Smärtfri');
		expect(html).toContain('Takkei');
	});
});
