-- Allow admins to insert positions for any user
CREATE POLICY "Admins can create positions for users"
ON positions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update wallet balances for any user
CREATE POLICY "Admins can update any wallet"
ON user_wallets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to insert wallet transactions for any user
CREATE POLICY "Admins can insert transactions for users"
ON wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);