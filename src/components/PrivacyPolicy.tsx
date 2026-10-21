export default function PrivacyPolicy() {
  return (
    <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
      <p style={{ color: 'var(--subtle)', fontSize: '0.72rem' }}>Last updated: October 2026</p>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>1. Who We Are</h3>
        <p>
          JaraWork is operated by Ace Corporation, a company registered in Nigeria. This Privacy Policy explains
          how we collect, use, and protect information when you use JaraWork at jarawork.onrender.com.
          For questions, contact us at{' '}
          <a href="mailto:legal@acecorporation.ng" style={{ color: 'var(--accent)' }}>
            legal@acecorporation.ng
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
            <strong>Marketplace API keys</strong> — if you connect a marketplace such as Shopify or Jumia,
            your API credentials are stored locally in your browser and are never transmitted to our servers.
          </li>
          <li>
            <strong>Push notification subscription</strong> — if you enable worker notifications, your browser
            push subscription endpoint is stored on our server solely to send you order alerts.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>3. Information We Do Not Collect</h3>
        <p>
          We do not collect your name, email address, phone number, national ID, or any personal identifying
          information beyond your public wallet address. We do not use cookies for tracking or advertising.
          We do not sell your data to any third party.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>4. Blockchain Data</h3>
        <p>
          All transactions, orders, and delivery proofs you submit through JaraWork are recorded on the Arc
          blockchain and are permanently public. Ace Corporation has no ability to delete or modify on-chain data.
          You should be aware that any information you include in an order or delivery proof will be permanently
          visible on the public blockchain.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>5. How We Use Information</h3>
        <p>We use the information we collect solely to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Operate the JaraWork platform and facilitate order fulfillment</li>
          <li>Send push notifications about order activity if you have opted in</li>
          <li>Monitor platform health and resolve disputes</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>6. Third-Party Services</h3>
        <p>
          JaraWork integrates with third-party marketplace platforms including Shopify, eBay, Amazon, and Jumia
          when you choose to connect them. Your use of those platforms is governed by their respective privacy
          policies. JaraWork uses Circle's infrastructure for blockchain transactions and developer-controlled
          wallet operations. Circle's privacy policy applies to those services.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>7. Data Security</h3>
        <p>
          We take reasonable measures to protect the information stored on our servers, including push notification
          subscriptions and server-side OAuth tokens. However, no internet transmission is completely secure.
          Your marketplace API keys are stored only in your own browser and never leave your device.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>8. Your Rights</h3>
        <p>
          You may request deletion of any off-chain data we hold about you, including push notification
          subscriptions and OAuth tokens, by contacting us at{' '}
          <a href="mailto:legal@acecorporation.ng" style={{ color: 'var(--accent)' }}>
            legal@acecorporation.ng
          </a>.
          On-chain data cannot be deleted due to the immutable nature of the blockchain.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>9. Children</h3>
        <p>
          JaraWork is not directed at children under the age of 18. We do not knowingly collect information
          from anyone under 18. If you believe a minor has used our platform, contact us and we will take
          appropriate action.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>10. Changes to This Policy</h3>
        <p>
          Ace Corporation may update this Privacy Policy from time to time. We will post the updated policy
          on the platform with a revised date. Continued use of JaraWork after changes are posted constitutes
          acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>11. Governing Law</h3>
        <p>
          This Privacy Policy is governed by the laws of the Federal Republic of Nigeria, including the
          Nigeria Data Protection Regulation (NDPR).
        </p>
      </section>

      <section>
        <h3 className="font-bold mb-1" style={{ color: 'var(--accent)' }}>12. Contact</h3>
        <p>
          For any privacy-related questions or requests, contact Ace Corporation at{' '}
          <a href="mailto:legal@acecorporation.ng" style={{ color: 'var(--accent)' }}>
            legal@acecorporation.ng
          </a>.
        </p>
      </section>
    </div>
  )
}
