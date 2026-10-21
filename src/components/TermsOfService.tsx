export default function TermsOfService() {
  return (
    <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
      <p style={{ color: 'var(--subtle)', fontSize: '0.72rem' }}>Last updated: October 2026</p>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>1. About JaraWork</h3>
        <p>
          JaraWork is an Order-to-Earner Marketplace operated by Ace Corporation, a company registered in Nigeria.
          JaraWork connects sellers and workers through a smart contract escrow system on the Arc blockchain.
          By accessing or using JaraWork at jarawork.onrender.com you agree to be bound by these Terms of Service.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>2. Eligibility</h3>
        <p>
          You must be at least 18 years old and legally capable of entering into a binding agreement to use JaraWork.
          By using the platform you represent that you meet these requirements.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>3. How the Platform Works</h3>
        <p>
          Sellers post orders by depositing USDC into the JaraWork escrow smart contract. Workers claim open orders,
          fulfill them, and submit delivery proof on chain. Upon confirmation of delivery, USDC is released
          automatically to the worker minus a 2.5 percent platform fee. Ace Corporation does not hold your funds.
          All payments are governed by the smart contract deployed at
          0x52A34aD73fAe6Bd151F25F1BCDf13AA7781422d5 on Arc Mainnet.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>4. Platform Fee</h3>
        <p>
          JaraWork charges a 2.5 percent fee on every completed order, taken automatically by the smart contract
          at the point of payment release. There are no subscription fees, listing fees, or hidden charges.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>5. Smart Contract and Blockchain Transactions</h3>
        <p>
          All transactions on JaraWork are executed on the Arc blockchain and are irreversible once confirmed.
          Ace Corporation does not have the ability to reverse, cancel, or modify confirmed blockchain transactions.
          You are solely responsible for the accuracy of any transaction you initiate, including wallet addresses,
          order amounts, and delivery proof submissions.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>6. Disputes</h3>
        <p>
          If a dispute arises between a buyer and a worker, either party may raise a dispute through the platform.
          Ace Corporation reserves the right to review available on-chain evidence and resolve disputes at its
          sole discretion by instructing the smart contract to release funds to either party.
          Dispute resolution decisions are final.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>7. Prohibited Activities</h3>
        <p>You agree not to use JaraWork to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Engage in fraudulent, deceptive, or misleading conduct</li>
          <li>Post orders or submit delivery proof that is false or fabricated</li>
          <li>Attempt to manipulate or exploit the smart contract</li>
          <li>Violate any applicable Nigerian or international law</li>
          <li>Use the platform for money laundering or financing of illegal activities</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>8. Disclaimer of Warranties</h3>
        <p>
          JaraWork is provided on an as-is and as-available basis. Ace Corporation makes no warranties, express
          or implied, regarding the reliability, availability, or fitness of the platform for any particular purpose.
          Use of the platform is at your own risk.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>9. Limitation of Liability</h3>
        <p>
          To the fullest extent permitted by Nigerian law, Ace Corporation shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of JaraWork, including loss of funds
          due to smart contract interactions, wallet errors, or blockchain network issues.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>10. Governing Law</h3>
        <p>
          These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
          Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Nigeria.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>11. Changes to These Terms</h3>
        <p>
          Ace Corporation reserves the right to update these Terms at any time. Continued use of the platform
          after changes are posted constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>12. Contact</h3>
        <p>
          For questions about these Terms, contact Ace Corporation at{' '}
          <a href="mailto:legal@acecorporation.ng" style={{ color: 'var(--accent)' }}>
            legal@acecorporation.ng
          </a>.
        </p>
      </section>
    </div>
  )
}
