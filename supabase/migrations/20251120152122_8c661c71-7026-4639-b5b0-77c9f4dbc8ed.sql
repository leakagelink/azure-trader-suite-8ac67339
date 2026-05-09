-- Allow users to update their own wallet balance
CREATE POLICY "Users can update own wallet"
ON user_wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own wallet transactions
CREATE POLICY "Users can insert own transactions"
ON wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);