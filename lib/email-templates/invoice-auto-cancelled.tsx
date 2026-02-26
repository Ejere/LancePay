import * as React from 'react';

export interface InvoiceAutoCancelledEmailProps {
    freelancerName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
    clientEmail: string;
}

export const InvoiceAutoCancelledEmail: React.FC<InvoiceAutoCancelledEmailProps> = ({
    freelancerName,
    invoiceNumber,
    amount,
    dueDate,
    daysOverdue,
    clientEmail,
}) => {
    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '500px', margin: '0 auto', padding: '24px' }}>
            <h2 style={{ color: '#111' }}>Invoice Auto-Cancelled</h2>
            <p>Hi {freelancerName},</p>
            <p>
                Your invoice <strong>{invoiceNumber}</strong> has been automatically cancelled because it is {daysOverdue} days overdue.
            </p>

            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '24px', borderRadius: '12px', textAlign: 'center', margin: '20px 0' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>${amount.toFixed(2)}</div>
                <div>USD</div>
            </div>

            <p style={{ color: '#666' }}><strong>Client:</strong> {clientEmail}</p>
            <p style={{ color: '#666' }}><strong>Due Date:</strong> {dueDate.toLocaleDateString()}</p>

            <p style={{ color: '#666', fontSize: '12px', marginTop: '20px' }}>
                LancePay - Get paid globally, withdraw locally
            </p>
        </div>
    );
};

export default InvoiceAutoCancelledEmail;
