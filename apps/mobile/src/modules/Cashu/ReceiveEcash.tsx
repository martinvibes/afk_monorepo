import '../../../applyGlobalPolyfills';

import {getDecodedToken, GetInfoResponse, MintQuoteResponse, MintQuoteState} from '@cashu/cashu-ts';
import {addProofs, ICashuInvoice, useCashu, useCashuStore, useNostrContext} from 'afk_nostr_sdk';
import * as Clipboard from 'expo-clipboard';
import React, {ChangeEvent, useEffect, useState} from 'react';
import {SafeAreaView, TouchableOpacity, View} from 'react-native';
import {Text, TextInput} from 'react-native';

import {CopyIconStack} from '../../assets/icons';
import {Button, Input} from '../../components';
import {useStyles, useTheme} from '../../hooks';
import {useDialog, useToast} from '../../hooks/modals';
import {SelectedTab} from '../../types/tab';
import {getInvoices, storeInvoices} from '../../utils/storage_cashu';
import GenerateQRCode from './qr/GenerateQRCode'; // Import the QR code component
import stylesheet from './styles';

export const ReceiveEcash = () => {
  const tabs = ['lightning', 'ecash'];

  const {ndkCashuWallet, ndkWallet} = useNostrContext();
  const {
    wallet,
    connectCashMint,
    connectCashWallet,
    requestMintQuote,
    generateMnemonic,
    derivedSeedFromMnenomicAndSaved,
    getMintInfo,
    mint,
    mintTokens,
    mintUrls,
    activeMintIndex,
  } = useCashu();
  const [ecash, setEcash] = useState<string | undefined>();
  const {isSeedCashuStorage, setIsSeedCashuStorage} = useCashuStore();

  const styles = useStyles(stylesheet);

  const [quote, setQuote] = useState<MintQuoteResponse | undefined>();
  const [infoMint, setMintInfo] = useState<GetInfoResponse | undefined>();
  const [qrCodeUrl, setQRCodeUrl] = useState<string | undefined>();
  const [mintsUrls, setMintUrls] = useState<string[]>(['https://mint.minibits.cash/Bitcoin']);
  const [isInvoiceModalVisible, setIsInvoiceModalVisible] = useState(false);
  const [isZapModalVisible, setIsZapModalVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [zapAmount, setZapAmount] = useState('');
  const [zapRecipient, setZapRecipient] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionData, setConnectionData] = useState<any>(null);

  const [generatedInvoice, setGeneratedInvoice] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceMemo, setInvoiceMemo] = useState('');
  const {theme} = useTheme();
  const [newSeed, setNewSeed] = useState<string | undefined>();

  const {showDialog, hideDialog} = useDialog();

  const {showToast} = useToast();

  const [selectedTab, setSelectedTab] = useState<SelectedTab | undefined>(
    SelectedTab.LIGHTNING_NETWORK_WALLET,
  );

  const handleChangeEcash = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEcash(value);
  };
  useEffect(() => {}, []);

  const generateInvoice = async () => {
    const mintUrl = mintUrls?.[activeMintIndex]?.url;
    if (!mintUrl || !invoiceAmount) return;
    try {
      const cashuMint = await connectCashMint(mintUrl);
      const wallet = await connectCashWallet(cashuMint?.mint);

      const quote = await requestMintQuote(Number(invoiceAmount));
      setQuote(quote?.request);
      console.log('quote', quote);
      setIsLoading(true);
      setIsInvoiceModalVisible(false);
      const invoicesLocal = await getInvoices();

      const cashuInvoice: ICashuInvoice = {
        bolt11: quote?.request?.request,
        quote: quote?.request?.quote,
        state: quote?.request?.state ?? MintQuoteState.UNPAID,
        date: new Date().getTime(),
        amount: Number(invoiceAmount),
        mint: mintUrl,
        quoteResponse: quote?.request,
      };

      if (invoicesLocal) {
        const invoices: ICashuInvoice[] = JSON.parse(invoicesLocal);
        console.log('invoices', invoices);
        storeInvoices([...invoices, cashuInvoice]);
      } else {
        console.log('no old invoicesLocal', invoicesLocal);
        storeInvoices([cashuInvoice]);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (type: 'lnbc' | 'ecash') => {
    if (!quote?.request) return;
    if (type == 'lnbc') {
      await Clipboard.setStringAsync(
        type === 'lnbc' ? quote?.request?.toString() : quote?.request?.toString(),
      );
    } else if (type == 'ecash') {
      if (ecash) {
        await Clipboard.setStringAsync(ecash);
      }
    }
    showToast({type: 'info', title: 'Copied to clipboard'});
  };

  const handleReceiveEcash = async () => {
    try {
      if (!ecash) {
        return;
      }
      const encoded = getDecodedToken(ecash);
      console.log('encoded', encoded);

      const response = await wallet?.receive(encoded);
      console.log('response', response);

      if (response) {
        showToast({title: 'ecash payment received', type: 'success'});
        await addProofs(response);
      }
    } catch (e) {
      console.log('handleReceiveEcash error', e);
    }
  };

  return (
    <SafeAreaView>
      <View>
        <View>
          <View style={styles.tabContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => handleTabChange(tab)}
              >
                <Text style={styles.tabText}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab == 'ecash' && (
            <>
              <TextInput
                placeholder="Enter token: cashuXYZ"
                value={ecash}
                onChangeText={setEcash}
                style={styles.input}
              />

              {ecash && (
                <View style={{marginVertical: 3}}>
                  <Text style={styles.text}>ecash token</Text>

                  <Input
                    value={ecash}
                    editable={false}
                    right={
                      <TouchableOpacity
                        onPress={() => handleCopy('ecash')}
                        style={{marginRight: 10}}
                      >
                        <CopyIconStack color={theme.colors.primary} />
                      </TouchableOpacity>
                    }
                  />

                  {/* Generate QR code for the eCash token */}
                  <GenerateQRCode data={ecash} size={200} />
                </View>
              )}

              <Button onPress={handleReceiveEcash}>Receive ecash</Button>
            </>
          )}

          {activeTab == 'lightning' && (
            <>
              <TextInput
                placeholder="Amount"
                keyboardType="numeric"
                value={invoiceAmount}
                onChangeText={setInvoiceAmount}
                style={styles.input}
              />

              <Button onPress={generateInvoice}>Generate invoice</Button>

              {quote?.request && (
                <View style={{marginVertical: 3}}>
                  <Text style={styles.text}>Invoice address</Text>

                  <Input
                    value={quote?.request}
                    editable={false}
                    right={
                      <TouchableOpacity
                        onPress={() => handleCopy('lnbc')}
                        style={{marginRight: 10}}
                      >
                        <CopyIconStack color={theme.colors.primary} />
                      </TouchableOpacity>
                    }
                  />

                  {/* Display the QR code for the invoice */}
                  <GenerateQRCode data={quote?.request} size={200} />
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};
