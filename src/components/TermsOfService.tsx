export default function TermsOfService() {
  return (
    <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
      <p style={{ color: 'var(--subtle)', fontSize: '0.72rem' }}>Last updated: October 2026</p>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>1. About JaraWork</h3>
        <p>
          JaraWork is an Order-to-Earner Marketplace operated by Ace Corporation, a company registered in the United States of America.
          JaraWork connects sellers and workers through a smart contract escrow system on the Arc blockchain.
          By accessing or using JaraWork at jarawork.online you agree to be bound by these Terms of Service.
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
          JaraWork charges a 2.5 percent fee on every order payment released through escrow. This fee is deducted
          automatically by the smart contract at the moment of payment release. There are no subscription fees,
          no hidden charges, and no regional surcharges.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>5. Smart Contract and Irreversibility</h3>
        <p>
          All escrow transactions are executed on the Arc blockchain and are irreversible once confirmed. Ace Corporation
          cannot reverse, cancel, or modify on-chain transactions after they have been submitted. You are solely
          responsible for verifying all transaction details before confirming any wallet action.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>6. Dispute Resolution</h3>
        <p>
          If a dispute arises between a buyer and a worker, either party may raise a dispute through the platform.
          Ace Corporation, as the contract owner, reserves the right to review on-chain evidence and resolve disputes
          in favour of either party at its sole discretion. Dispute resolution decisions are final.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>7. Prohibited Activities</h3>
        <p>You agree not to use JaraWork to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Engage in fraud, money laundering, or any illegal activity</li>
          <li>Submit false delivery proof</li>
          <li>Manipulate or attempt to exploit the smart contract</li>
          <li>Violate any applicable United States or international law</li>
          <li>Harass, threaten, or harm other users of the platform</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>8. No Warranties</h3>
        <p>
          JaraWork is provided on an as-is and as-available basis. Ace Corporation makes no warranties, express or implied,
          regarding the platform's availability, accuracy, or fitness for a particular purpose. Blockchain networks and
          smart contracts carry inherent risks including but not limited to network outages, bugs, and protocol changes.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>9. Limitation of Liability</h3>
        <p>
          To the fullest extent permitted by United States law, Ace Corporation shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the platform, including loss of funds
          due to smart contract interactions, wallet errors, or blockchain network failures.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>10. Third-Party Marketplaces</h3>
        <p>
          JaraWork integrates with third-party marketplaces including Shopify, eBay, Amazon, Jumia, and Jaramarket.
          Ace Corporation is not responsible for the terms, policies, or actions of these third-party platforms.
          Your use of those platforms is governed by their respective terms of service.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>11. Governing Law</h3>
        <p>
          These Terms are governed by and construed in accordance with the laws of the United States of America.
          Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of the United States.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>12. Contact</h3>
        <p>
          For questions about these Terms of Service, contact Ace Corporation at{' '}
          <a href="mailto:info@acecorporation.com.ng" style={{ color: 'var(--accent)' }}>
            info@acecorporation.com.ng
          </a>.
        </p>
      </section>
    </div>
  )
}
