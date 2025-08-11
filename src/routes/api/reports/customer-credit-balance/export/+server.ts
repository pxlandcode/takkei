import { getCustomerCreditRows } from '$lib/services/api/reports/customerCreditBalance';
import ExcelJS from 'exceljs';

export const GET = async ({ url }) => {
	const start_date = url.searchParams.get('start_date');
	const end_date = url.searchParams.get('end_date');
	if (!start_date || !end_date) {
		return new Response('Missing start_date or end_date', { status: 400 });
	}

	const rows = await getCustomerCreditRows(start_date, end_date);

	const wb = new ExcelJS.Workbook();

	//
	// SHEET 1: Tillgodohavande (main table)
	//
	const ws = wb.addWorksheet('Tillgodohavande');

	const headers = [
		'Klient',
		'PaketId',
		'Fakt.nr',
		'Kund (kundnr)',
		'Produkt',
		'Paketets pris',
		'Antal pass',
		'Pris per pass',
		'Antal fakturor',
		`Antal fakt. t.o.m. ${end_date}`,
		'Fakturerade pass',
		'Fakturerad summa',
		'Utnyttjade pass',
		`Utnyttjade pass ${start_date.slice(0, 7)}`,
		'Återstående pass',
		'Utnyttjad summa',
		`Utnyttjad summa ${start_date.slice(0, 7)}`,
		'Skuld/fordran i kronor'
	];

	ws.addRow(headers);
	ws.getRow(1).font = { bold: true };

	// body rows
	for (const r of rows) {
		ws.addRow([
			r.client,
			r.packageId,
			r.invoiceNumbers.join(', '),
			r.customerNo ? `${r.customerName} (${r.customerNo})` : r.customerName,
			r.product,
			r.packagePrice,
			r.sessions,
			r.pricePerSession,
			r.invoiceCount,
			r.invoicesUntilEnd,
			r.paidSessions,
			r.paidSum,
			r.usedSessions,
			r.usedSessionsMonth,
			r.remainingSessions,
			r.usedSum,
			r.usedSumMonth,
			r.balance
		]);
	}

	// formats
	const moneyFmt = '#,##0.00';
	const intFmt = '0';
	const moneyCols = [6, 8, 12, 16, 17, 18]; // F,H,L,P,Q,R
	const intCols = [2, 7, 9, 10, 13, 14, 15, 11]; // B,G,I,J,M,N,O,K (K=Fakturerade pass)
	for (const i of moneyCols) ws.getColumn(i).numFmt = moneyFmt;
	for (const i of intCols) ws.getColumn(i).numFmt = intFmt;

	// auto width
	headers.forEach((h, i) => {
		const col = ws.getColumn(i + 1);
		const max = Math.max(
			String(h).length,
			...col.values.slice(2).map((v: any) => String(v ?? '').length)
		);
		col.width = Math.min(Math.max(max + 2, 10), 50);
	});

	//
	// SHEET 2: Bokningar utan paket
	//
	const ws2 = wb.addWorksheet('Bokningar utan paket');

	// title row
	ws2.mergeCells('A1:E1');
	ws2.getCell('A1').value = 'Bokningar utan paket';
	ws2.getCell('A1').font = { bold: true, size: 16 };

	const s2Headers = ['Kund', 'Datum/Tid', 'Övrigt', 'Tränare', 'Belopp'];
	ws2.addRow([]);
	ws2.addRow(s2Headers);
	ws2.getRow(3).font = { bold: true };

	// TODO: populate bookings without package here
	// const bookings = await getBookingsWithoutPackage(start_date, end_date); // implement in your service
	const bookings: Array<{
		customer: string;
		dateTime: string; // "YYYY-MM-DD HH:mm"
		note?: string;
		trainer?: string;
		amount?: number; // in kr
	}> = [];

	for (const b of bookings) {
		ws2.addRow([b.customer, b.dateTime, b.note ?? '', b.trainer ?? '', b.amount ?? 0]);
	}

	// formats + widths for sheet 2
	ws2.getColumn(2).width = 19; // Datum/Tid
	ws2.getColumn(5).numFmt = moneyFmt;
	['A', 'B', 'C', 'D', 'E'].forEach(
		(col) => (ws2.getColumn(col).alignment = { vertical: 'middle' })
	);

	// Total row on sheet 2 (sum of Belopp)
	const s2HeaderRow = 3; // Title (1), blank (2), header (3)
	const s2FirstDataRow = s2HeaderRow + 1; // row 4
	const s2LastDataRow = ws2.rowCount; // last actual booking row

	// Add totals row
	ws2.addRow([]);
	const s2TotalRow = ws2.addRow([
		'',
		'',
		'',
		'Total',
		{ formula: `SUM(E${s2FirstDataRow}:E${s2LastDataRow})` }
	]).number;
	ws2.getCell(`D${s2TotalRow}`).font = { bold: true };
	ws2.getCell(`E${s2TotalRow}`).font = { bold: true };
	ws2.getCell(`E${s2TotalRow}`).numFmt = moneyFmt;

	//
	// SUMMARY block at bottom of sheet 1
	//
	// Positions/columns on sheet 1:
	// M = 13 (Utnyttjade pass), N = 14 (Utnyttjade pass <månad>), Q = 17 (Utnyttjad summa <månad>)
	const lastDataRow = ws.rowCount; // includes header, but we only care about data range 2..lastDataRow
	const startSummaryRow = lastDataRow + 2;

	// Row: "Utan paket"  [count from sheet2] ... [sum from sheet2]
	ws.getCell(`A${startSummaryRow}`).value = 'Utan paket';
	ws.getCell(`B${startSummaryRow}`).value = {
		formula: `COUNTA('Bokningar utan paket'!A${s2FirstDataRow}:A${s2LastDataRow})`
	};
	ws.getCell(`R${startSummaryRow}`).value = {
		formula: `SUM('Bokningar utan paket'!E${s2FirstDataRow}:E${s2LastDataRow})`
	};
	ws.getCell(`R${startSummaryRow}`).numFmt = moneyFmt;
	ws.getCell(`R${startSummaryRow}`).numFmt = moneyFmt;

	// Row: "MF träningar" (unknown definition) -> leave 0 for now; change once we define the source
	ws.getCell(`A${startSummaryRow + 1}`).value = 'MF träningar';
	ws.getCell(`B${startSummaryRow + 1}`).value = 0;

	// Row: "Antal träningar" = sum of "Utnyttjade pass <månad>" (column N)
	ws.getCell(`A${startSummaryRow + 2}`).value = 'Antal träningar';
	ws.getCell(`B${startSummaryRow + 2}`).value = { formula: `SUM(N2:N${lastDataRow})` };

	// Right side: "Intäkt på utförda timmar i {månad}" = sum of "Utnyttjad summa <månad>" (column Q)
	ws.getCell(`A${startSummaryRow + 3}`).value =
		`Intäkt på utförda timmar i ${new Date(start_date).toLocaleDateString('sv-SE', { month: 'long' })}`;
	ws.getCell(`B${startSummaryRow + 3}`).value = { formula: `SUM(Q2:Q${lastDataRow})` };
	ws.getCell(`B${startSummaryRow + 3}`).numFmt = moneyFmt;

	// Blank line
	// Average price = (Intäkt på utförda timmar <månad>) / (Antal träningar)
	ws.getCell(`A${startSummaryRow + 4}`).value = 'Genomsnittspris på utförda timmar';
	ws.getCell(`B${startSummaryRow + 4}`).value = {
		formula: `IFERROR(B${startSummaryRow + 3}/B${startSummaryRow + 2},0)`
	};
	ws.getCell(`B${startSummaryRow + 4}`).numFmt = moneyFmt;

	// Style the left labels a bit
	[startSummaryRow, startSummaryRow + 1, startSummaryRow + 2, startSummaryRow + 4].forEach((r) => {
		ws.getCell(`A${r}`).font = { bold: true };
		ws.getCell(`D${r}`).font = { bold: true };
	});

	// (Optional) keep your “total saldo” row if you want:
	const totalRow = startSummaryRow - 1;
	ws.addRow(new Array(headers.length).fill(''));
	ws.getCell(totalRow, headers.length).value = { formula: `SUM(R2:R${lastDataRow})` };
	ws.getCell(totalRow, headers.length).numFmt = moneyFmt;

	// send file
	const buffer = await wb.xlsx.writeBuffer();
	const monthStr = end_date.slice(0, 7);
	const filename = `resultat_kunders_tillgodohavande_${monthStr.replace('-', '')}_${new Date()
		.toISOString()
		.slice(0, 19)
		.replace(/[-:T]/g, '')}.xlsx`;

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
