export default function PrivacyPolicy() {
  return (
    <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
      <p style={{ color: 'var(--subtle)', fontSize: '0.72rem' }}>Last updated: October 2026</p>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>1. Who We Are</h3>
        <p>
          JaraWork is operated by Ace Corporation, a company registered in the United States of America. This Privacy Policy explains
          how we collect, use, and protect information when you use JaraWork at jarawork.onrender.com.
          For questions, contact us at{' '}
          <a href="mailto:info@acecorporation.com.ng" style={{ color: 'var(--accent)' }}>
            info@acecorporation.com.ng
          </a>.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>2. Information We Collect</h3>
        <p>JaraWork collects minimal information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Wallet address</strong> — your public blockchain address, which is visible on-chain by nature
            of using a public blockchain.
          </li>
          <li>
            <strong>Order data</strong> — order titles, descriptions, amounts, and delivery proof you submit,
            which are stored on the Arc blockchain and are publicly visible.
          </li>
          <li>
            <strong>Push notification subscription</strong> — if you enable worker notifications, your browser
            push subscription endpoint is stored on our server. This is used solely to deliver order alerts.
          </li>
          <li>
            <strong>Marketplace API tokens</strong> — if you connect a marketplace such as Shopify or eBay,
            the OAuth access token is stored in server memory for the duration of your session. It is not
            persisted to a database or shared with third parties.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>3. What We Do Not Collect</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not collect your name, email address, or phone number</li>
          <li>We do not use cookies or tracking pixels</li>
          <li>We do not use advertising networks or sell data to third parties</li>
          <li>We do not store private keys or seed phrases</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>4. Blockchain Data</h3>
        <p>
          All order data, wallet addresses, and transaction records submitted through JaraWork are stored permanently
          on the Arc blockchain. This data is public, immutable, and cannot be deleted by Ace Corporation or anyone else.
          By using JaraWork you acknowledge and accept this characteristic of blockchain technology.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>5. How We Use Information</h3>
        <p>We use the information we collect solely to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Display your orders and activity on the JaraWork platform</li>
          <li>Send push notifications about order activity if you have opted in</li>
          <li>Fetch orders from connected marketplaces on your behalf</li>
          <li>Operate the autonomous agent that manages escrow transactions</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>6. Third-Party Services</h3>
        <p>JaraWork integrates with the following third-party services:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Shopify, eBay, Amazon, Jumia, Jaramarket</strong> — marketplace order data accessed via OAuth on your behalf</li>
          <li><strong>Circle</strong> — developer-controlled wallet infrastructure for autonomous transaction signing</li>
          <li><strong>Arc Mainnet</strong> — public blockchain network for all escrow transactions</li>
          <li><strong>Render</strong> — cloud hosting provider for the JaraWork application server</li>
        </ul>
        <p className="mt-2">
          Each of these services has its own privacy policy. Ace Corporation is not responsible for the data practices
          of third-party providers.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>7. Data Retention</h3>
        <p>
          Off-chain data such as push notification subscriptions and marketplace session tokens are retained only
          as long as necessary for platform operation. On-chain data is permanent and cannot be deleted.
          You may request deletion of any off-chain data we hold by contacting us at the email below.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>8. Security</h3>
        <p>
          JaraWork does not store private keys. All wallet interactions are performed client-side through your
          own wallet software. The autonomous agent uses Circle's MPC-based developer-controlled wallet
          infrastructure, which means no raw private keys are stored on our servers.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>9. Children</h3>
        <p>
          JaraWork is not intended for users under the age of 18. We do not knowingly collect information
          from anyone under 18 years of age.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>10. Changes to This Policy</h3>
        <p>
          Ace Corporation may update this Privacy Policy from time to time. Changes will be reflected by an
          updated date at the top of this page. Continued use of JaraWork after changes constitutes acceptance
          of the updated policy.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>11. Your Rights</h3>
        <p>
          You have the right to request access to, correction of, or deletion of any off-chain personal data
          we hold about you. To exercise these rights, contact us at the email below. Note that on-chain data
          cannot be altered or deleted due to the immutable nature of blockchain technology.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>12. Governing Law</h3>
        <p>
          This Privacy Policy is governed by the laws of the United States of America, including applicable
          federal and state privacy laws.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>13. Contact</h3>
        <p>
          For privacy-related questions or data requests, contact Ace Corporation at{' '}
          <a href="mailto:info@acecorporation.com.ng" style={{ color: 'var(--accent)' }}>
            info@acecorporation.com.ng
          </a>.
        </p>
      </section>
    </div>
  )
}
