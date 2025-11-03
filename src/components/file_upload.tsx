import { DataTable } from "@/components/data_table";
import { columns } from "@/components/table_colums";
import { DropZone } from "@/components/ui/dropzone";
import Papa from 'papaparse';
import { PDFParse } from 'pdf-parse';
import { useState } from "react";
import { AiFileSummary } from "./ai_file_summary";


PDFParse.setWorker('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs');

interface Transaction {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
}

export const FileUpload = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');


    const processCSV = async (file: File) => {
        return new Promise<Transaction[]>((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        if (results.data.length > 0) {
                            console.log('CSV Column names:', Object.keys(results.data[0] as object));
                            console.log('First row sample:', results.data[0]);
                        }

                        const transactions: Transaction[] = results.data.map((row: any) => {
                            const date = row.Date || row.date || row.TransactionDate || row['Transaction Date']
                                || row['Posting Date'] || row['Post Date'] || row.DATE;

                            const description = row.Narrative || row.Description || row.description || row.Memo || row.memo
                                || row.Details || row.details || row.Payee || row.payee || row.DESCRIPTION;

                            let amount = 0;
                            let isExpense = false;

                            const debitAmount = row['Debit Amount'];
                            const creditAmount = row['Credit Amount'];

                            if (debitAmount !== undefined && debitAmount !== null && debitAmount !== 0) {
                                amount = parseFloat(debitAmount);
                                isExpense = true;
                            } else if (creditAmount !== undefined && creditAmount !== null && creditAmount !== 0) {
                                amount = parseFloat(creditAmount);
                                isExpense = false;
                            }
                            else if (row.Amount !== undefined && row.Amount !== null) {
                                amount = parseFloat(row.Amount);
                            } else if (row.amount !== undefined && row.amount !== null) {
                                amount = parseFloat(row.amount);
                            } else if (row.AMOUNT !== undefined && row.AMOUNT !== null) {
                                amount = parseFloat(row.AMOUNT);
                            }
                            else if (row.Debit !== undefined || row.Credit !== undefined) {
                                amount = parseFloat(row.Debit || row.Credit || 0);
                                isExpense = row.Debit !== undefined;
                            } else if (row.debit !== undefined || row.credit !== undefined) {
                                amount = parseFloat(row.debit || row.credit || 0);
                                isExpense = row.debit !== undefined;
                            }
                            else if (row.Withdrawal !== undefined || row.Deposit !== undefined) {
                                amount = parseFloat(row.Withdrawal || row.Deposit || 0);
                                isExpense = row.Withdrawal !== undefined;
                            } else if (row.withdrawal !== undefined || row.deposit !== undefined) {
                                amount = parseFloat(row.withdrawal || row.deposit || 0);
                                isExpense = row.withdrawal !== undefined;
                            }

                            if (amount === 0) {
                                console.warn('Could not find amount in row:', row);
                            }

                            if (amount < 0) {
                                isExpense = true;
                            }

                            return {
                                date: date,
                                description: description,
                                amount: Math.abs(amount),
                                type: isExpense ? 'expense' : 'income'
                            };
                        });

                        resolve(transactions);
                    } catch (err) {
                        reject(new Error('Failed to parse CSV data. Please check the file format.'));
                    }
                },
                error: (error) => {
                    reject(new Error(`CSV parsing error: ${error.message}`));
                }
            });
        });
    };


    // const processPdf = async (file: File): Promise<Transaction[]> => {
    //     const arrayBuffer = await file.arrayBuffer();
    //     const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    //     const result = await parser.getText();
    //     const pdfText = result.text;

    //     if (!pdfText || pdfText.trim().length === 0) {
    //         throw new Error('Could not extract text from PDF. The PDF might be image-based or encrypted.');
    //     }

    //     const openai = new OpenAI({
    //         apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    //         dangerouslyAllowBrowser: true // Only OK for testing!
    //     });

    //     const response = await openai.chat.completions.create({
    //         model: "",
    //         messages: [
    //             {
    //                 role: "user",
    //                 content: `Extract all transactions from this bank statement text. 
    //             Return ONLY a JSON array with this exact format:
    //             [{"date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "income" or "expense"}]

    //             Rules:
    //             - Positive amounts or deposits are "income"
    //             - Negative amounts or withdrawals are "expense"  
    //             - Amount should always be positive number
    //             - Return valid JSON only, no markdown or explanation

    //             Bank statement text:
    //             ${pdfText}`
    //             }
    //         ],
    //         max_tokens: 4096
    //     });

    //     const content = response.choices[0].message.content;

    //     if (!content) {
    //         throw new Error('No content returned from OpenAI. Please try again.');
    //     }

    //     const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    //     const parsed = JSON.parse(cleanedContent) as Transaction[];
    //     return parsed;
    // };

    const processFile = async (file: File) => {
        setLoading(true);
        setError(null);
        setFileName(file.name);

        try {
            let extractedTransactions: Transaction[];

            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                extractedTransactions = await processCSV(file);
            }
            // } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            //     extractedTransactions = await processPdf(file);
            // } 
            else {
                throw new Error('Unsupported file type. Please upload a PDF or CSV file.');
            }

            setTransactions(extractedTransactions);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2 className="text-2xl pb-4">Upload Bank Statement</h2>

            <DropZone
                onDrop={(acceptedFiles) => {
                    if (acceptedFiles.length > 0) {
                        processFile(acceptedFiles[0]);
                    }
                }}
                accept={{
                    'application/pdf': ['.pdf'],
                    'text/csv': ['.csv']
                }}
                multiple={false}
                description="Drag and drop your bank statement here"
                acceptedFormats="Supports CSV (recommended) and PDF files"
            />

            {loading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '18px' }}>
                        {fileName.endsWith('.csv') ? '📊 Parsing CSV...' : '🔄 Processing PDF with OpenAI...'}
                    </p>
                </div>
            )}

            {error && (
                <div style={{
                    color: '#721c24',
                    padding: '15px',
                    backgroundColor: '#f8d7da',
                    borderRadius: '4px',
                    border: '1px solid #f5c6cb',
                    marginBottom: '20px'
                }}>
                    ❌ {error}
                </div>
            )}

            {transactions.length > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold">
                            Extracted Transactions ({transactions.length})
                        </h3>
                        <span className="text-sm text-gray-600">
                            from {fileName}
                        </span>
                    </div>
                    <DataTable columns={columns} data={transactions} />


                    <AiFileSummary transactions={transactions} fileName={fileName} />

                    <h2 className="text-xl font-semibold mt-4">Total Income: {transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</h2>
                    <h2 className="text-xl font-semibold">Total Expenses: {transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</h2>
                    <h1 className="text-2xl font-semibold mt-4">Net Balance: {transactions.map((t) => t.type === 'income' ? t.amount : -t.amount).reduce((acc, t) => acc + t, 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</h1>
                </div>
            )}
        </div>
    );
}