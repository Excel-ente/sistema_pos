document.addEventListener('DOMContentLoaded', function() {


    // URL de la hoja de Google Sheets para productos (modifica con tu ID y GID)
    const productsSheetUrl = 'https://docs.google.com/spreadsheets/d/1mcrkDHbZr85jJl6lsliWOwdDwDfzY4VivL2vfsXEHbs/gviz/tq?tqx=out:json&gid=0';
    const productsUrlNoCache = productsSheetUrl + '&_ts=' + Date.now();

    // Se carga la lista de productos desde la hoja y se asigna a window.products
    fetch(productsUrlNoCache)
      .then(response => response.text())
      .then(text => {
          const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
          const productData = JSON.parse(jsonString);
          // Asumimos que la hoja tiene las columnas: id, code, name, price y unit (en ese orden)
          window.products = productData.table.rows.map(row => ({
              id: row.c[0]?.v,
              code: row.c[1]?.v,
              name: row.c[2]?.v,
              price: parseFloat(row.c[3]?.v),
              unit: row.c[4]?.v
          }));
          init();
      })
      .catch(error => {
          console.error('Error fetching products:', error);
          window.products = [];
          init();
      });

    // ---------------------------
    // Variables de estado y DOM
    // ---------------------------
    let cart = [];
    let filteredProducts = [...(window.products || [])];
    let selectedPaymentMethod = 'cash';
    let mixedPayment = false;
    let payments = [];
    let codeReader = null;

    const currentDateElement = document.getElementById('current-date');
    const productsGridElement = document.getElementById('products-grid');
    const cartContentElement = document.getElementById('cart-content');
    const searchInputElement = document.getElementById('search-input');
    const scannerBtnElement = document.getElementById('scanner-btn');
    const scannerModalElement = document.getElementById('scanner-modal');
    const scannerCancelElement = document.getElementById('scanner-cancel');
    const scannerVideoElement = document.getElementById('scanner-video');
    const scannerErrorElement = document.getElementById('scanner-error');
    const scannerErrorMessageElement = document.getElementById('scanner-error-message');
    const paymentModalElement = document.getElementById('payment-modal');
    const paymentTotalElement = document.getElementById('payment-total');
    const mixedPaymentToggleElement = document.getElementById('mixed-payment-toggle');
    const singlePaymentContainerElement = document.getElementById('single-payment-container');
    const mixedPaymentContainerElement = document.getElementById('mixed-payment-container');
    const singleReceivedAmountElement = document.getElementById('single-received-amount');
    const singleChangeContainerElement = document.getElementById('single-change-container');
    const singleChangeAmountElement = document.getElementById('single-change-amount');
    const cardPaymentAmountElement = document.getElementById('card-payment-amount');
    const qrPaymentAmountElement = document.getElementById('qr-payment-amount');
    const mixedTotalPaidElement = document.getElementById('mixed-total-paid');
    const mixedRemainingElement = document.getElementById('mixed-remaining');
    const paymentsListElement = document.getElementById('payments-list');
    const mixedPaymentAmountElement = document.getElementById('mixed-payment-amount');
    const mixedReceivedAmountElement = document.getElementById('mixed-received-amount');
    const mixedChangeContainerElement = document.getElementById('mixed-change-container');
    const mixedChangeAmountElement = document.getElementById('mixed-change-amount');
    const mixedCardAmountElement = document.getElementById('mixed-card-amount');
    const mixedQrAmountElement = document.getElementById('mixed-qr-amount');
    const addPaymentBtnElement = document.getElementById('add-payment-btn');
    const paymentCancelElement = document.getElementById('payment-cancel');
    const paymentConfirmElement = document.getElementById('payment-confirm');
    const receiptModalElement = document.getElementById('receipt-modal');
    const receiptContentElement = document.getElementById('receipt-content');
    const printReceiptElement = document.getElementById('print-receipt');
    const finishSaleElement = document.getElementById('finish-sale');

    // ---------------------------
    // Inicialización
    // ---------------------------
    function init() {
        currentDateElement.textContent = new Date().toLocaleDateString();
        // Al cargar los productos, actualizamos filteredProducts
        filteredProducts = [...(window.products || [])];
        renderProducts();
        renderCart();
        addEventListeners();
    }

    // ---------------------------
    // Event Listeners
    // ---------------------------
    function addEventListeners() {
        searchInputElement.addEventListener('input', handleSearch);
        scannerBtnElement.addEventListener('click', openScannerModal);
        scannerCancelElement.addEventListener('click', closeScannerModal);
        mixedPaymentToggleElement.addEventListener('change', toggleMixedPayment);
        singleReceivedAmountElement.addEventListener('input', updateSingleChange);
        mixedReceivedAmountElement.addEventListener('input', updateMixedChange);
        addPaymentBtnElement.addEventListener('click', addPayment);
        paymentCancelElement.addEventListener('click', closePaymentModal);
        paymentConfirmElement.addEventListener('click', processPayment);
        printReceiptElement.addEventListener('click', printReceipt);
        finishSaleElement.addEventListener('click', finishSale);

        document.querySelectorAll('.tab-trigger').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                const tabGroup = this.closest('.tabs');
                tabGroup.querySelectorAll('.tab-trigger').forEach(t => {
                    t.classList.remove('active');
                });
                this.classList.add('active');
                tabGroup.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabId}-tab`).classList.add('active');
                if (tabId === 'cash' || tabId === 'mixed-cash') {
                    selectedPaymentMethod = 'cash';
                } else if (tabId === 'card' || tabId === 'mixed-card') {
                    selectedPaymentMethod = 'card';
                } else if (tabId === 'qr' || tabId === 'mixed-qr') {
                    selectedPaymentMethod = 'qr';
                }
            });
        });
    }

    // ---------------------------
    // Helpers y Renderización
    // ---------------------------
    function formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    }

    function renderProducts() {
        if (filteredProducts.length === 0) {
            productsGridElement.innerHTML = `<div class="no-products">No se encontraron productos</div>`;
            return;
        }
        productsGridElement.innerHTML = filteredProducts.map(product => `
            <div class="product-card">
                <div class="product-content">
                    <div>
                        <p class="product-code">${product.code}</p>
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-price">${formatCurrency(product.price)}</p>
                        <p class="product-unit">${product.unit}</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="addToCart(${product.id})">
                        Agregar
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderCart() {
        if (cart.length === 0) {
            cartContentElement.innerHTML = `<div class="cart-empty">El carrito está vacío</div>`;
            return;
        }
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        cartContentElement.innerHTML = `
            <div class="cart-table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Precio</th>
                            <th>Cantidad</th>
                            <th>Subtotal</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cart.map(item => `
                            <tr>
                                <td>${item.code}</td>
                                <td>${item.name}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td>
                                    <div class="quantity-control">
                                        <button class="btn btn-outline btn-sm" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateQuantity(${item.id}, this.value)">
                                        <button class="btn btn-outline btn-sm" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </td>
                                <td>${formatCurrency(item.subtotal)}</td>
                                <td>
                                    <button class="btn btn-outline btn-sm btn-danger" onclick="removeFromCart(${item.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="cart-summary">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                <div class="summary-row">
                    <span>IVA (16%):</span>
                    <span>${formatCurrency(tax)}</span>
                </div>
                <div class="summary-row summary-total">
                    <span>Total:</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </div>
            <div class="cart-actions">
                <button class="btn btn-outline" onclick="clearCart()">Limpiar</button>
                <button class="btn btn-primary" onclick="openPaymentModal()">Totalizar</button>
            </div>
        `;
    }

    function handleSearch() {
        const searchTerm = searchInputElement.value.toLowerCase().trim();
        if (searchTerm === '') {
            filteredProducts = [...(window.products || [])];
        } else {
            filteredProducts = (window.products || []).filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.code.toLowerCase() === searchTerm
            );
        }
        renderProducts();
    }

    // ---------------------------
    // Funciones de Carrito
    // ---------------------------
    window.addToCart = function(productId) {
        const product = (window.products || []).find(p => p.id === productId);
        if (!product) return;
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.subtotal = existingItem.quantity * existingItem.price;
        } else {
            cart.push({
                ...product,
                quantity: 1,
                subtotal: product.price
            });
        }
        renderCart();
    };

    window.updateQuantity = function(productId, quantity) {
        quantity = parseInt(quantity);
        if (quantity < 1) return;
        const item = cart.find(item => item.id === productId);
        if (item) {
            item.quantity = quantity;
            item.subtotal = item.quantity * item.price;
            renderCart();
        }
    };

    window.removeFromCart = function(productId) {
        cart = cart.filter(item => item.id !== productId);
        renderCart();
    };

    window.clearCart = function() {
        cart = [];
        renderCart();
    };

    // ---------------------------
    // Funciones del Escáner de Códigos de Barras
    // ---------------------------
    function openScannerModal() {
        scannerModalElement.classList.add('active');
        initBarcodeScanner();
    }

    function closeScannerModal() {
        scannerModalElement.classList.remove('active');
        if (codeReader) {
            codeReader.reset();
            codeReader = null;
        }
    }

    function initBarcodeScanner() {
        scannerErrorElement.style.display = 'none';
        const hints = new Map();
        const formats = [
            window.ZXing.BarcodeFormat.EAN_13,
            window.ZXing.BarcodeFormat.EAN_8,
            window.ZXing.BarcodeFormat.UPC_A,
            window.ZXing.BarcodeFormat.UPC_E,
            window.ZXing.BarcodeFormat.CODE_39,
            window.ZXing.BarcodeFormat.CODE_128,
            window.ZXing.BarcodeFormat.QR_CODE
        ];
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
        codeReader = new window.ZXing.BrowserMultiFormatReader(hints);
        codeReader.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            scannerVideoElement,
            (result, error) => {
                if (result) {
                    const barcodeValue = result.getText();
                    console.log("Barcode detected:", barcodeValue);
                    const product = (window.products || []).find(p => p.code === barcodeValue);
                    if (product) {
                        addToCart(product.id);
                    }
                    closeScannerModal();
                    searchInputElement.value = barcodeValue;
                    handleSearch();
                }
                if (error && !(error instanceof TypeError)) {
                    console.error("Barcode scanning error:", error);
                }
            }
        ).catch(err => {
            console.error("Error accessing camera:", err);
            scannerErrorMessageElement.textContent = "No se pudo acceder a la cámara. Verifique los permisos.";
            scannerErrorElement.style.display = 'flex';
        });
    }

    // ---------------------------
    // Funciones del Modal de Pago
    // ---------------------------
    function openPaymentModal() {
        if (cart.length === 0) return;
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        payments = [];
        mixedPayment = false;
        selectedPaymentMethod = 'cash';
        mixedPaymentToggleElement.checked = false;
        singlePaymentContainerElement.style.display = 'block';
        mixedPaymentContainerElement.style.display = 'none';
        singleReceivedAmountElement.value = '';
        singleChangeContainerElement.style.display = 'none';
        mixedPaymentAmountElement.value = '';
        mixedReceivedAmountElement.value = '';
        mixedChangeContainerElement.style.display = 'none';
        mixedCardAmountElement.value = '';
        mixedQrAmountElement.value = '';
        paymentsListElement.innerHTML = '';
        paymentTotalElement.textContent = formatCurrency(total);
        cardPaymentAmountElement.textContent = formatCurrency(total);
        qrPaymentAmountElement.textContent = formatCurrency(total);
        mixedRemainingElement.textContent = formatCurrency(total);
        paymentModalElement.classList.add('active');
        setTimeout(() => {
            singleReceivedAmountElement.focus();
        }, 300);
    }

    function closePaymentModal() {
        paymentModalElement.classList.remove('active');
    }

    function toggleMixedPayment() {
        mixedPayment = mixedPaymentToggleElement.checked;
        if (mixedPayment) {
            singlePaymentContainerElement.style.display = 'none';
            mixedPaymentContainerElement.style.display = 'block';
        } else {
            singlePaymentContainerElement.style.display = 'block';
            mixedPaymentContainerElement.style.display = 'none';
        }
    }

    function updateSingleChange() {
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        const receivedAmount = parseFloat(singleReceivedAmountElement.value) || 0;
        if (receivedAmount >= total) {
            const change = receivedAmount - total;
            singleChangeAmountElement.textContent = formatCurrency(change);
            singleChangeContainerElement.style.display = 'block';
            paymentConfirmElement.disabled = false;
        } else {
            singleChangeContainerElement.style.display = 'none';
            paymentConfirmElement.disabled = true;
        }
    }

    function updateMixedChange() {
        const paymentAmount = parseFloat(mixedPaymentAmountElement.value) || 0;
        const receivedAmount = parseFloat(mixedReceivedAmountElement.value) || 0;
        if (receivedAmount >= paymentAmount && paymentAmount > 0) {
            const change = receivedAmount - paymentAmount;
            mixedChangeAmountElement.textContent = formatCurrency(change);
            mixedChangeContainerElement.style.display = 'block';
        } else {
            mixedChangeContainerElement.style.display = 'none';
        }
    }

    function addPayment() {
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const remaining = total - totalPaid;
        let paymentAmount = 0;
        let receivedAmount = 0;
        if (selectedPaymentMethod === 'cash') {
            paymentAmount = parseFloat(mixedPaymentAmountElement.value) || 0;
            receivedAmount = parseFloat(mixedReceivedAmountElement.value) || 0;
            if (paymentAmount <= 0 || receivedAmount < paymentAmount) {
                return;
            }
        } else if (selectedPaymentMethod === 'card') {
            paymentAmount = parseFloat(mixedCardAmountElement.value) || 0;
            if (paymentAmount <= 0) {
                return;
            }
        } else if (selectedPaymentMethod === 'qr') {
            paymentAmount = parseFloat(mixedQrAmountElement.value) || 0;
            if (paymentAmount <= 0) {
                return;
            }
        }
        if (paymentAmount > remaining) {
            return;
        }
        const payment = {
            method: selectedPaymentMethod,
            amount: paymentAmount
        };
        if (selectedPaymentMethod === 'cash') {
            payment.receivedAmount = receivedAmount;
            payment.change = receivedAmount - paymentAmount;
        }
        payments.push(payment);
        updateMixedPaymentUI();
        mixedPaymentAmountElement.value = '';
        mixedReceivedAmountElement.value = '';
        mixedChangeContainerElement.style.display = 'none';
        mixedCardAmountElement.value = '';
        mixedQrAmountElement.value = '';
    }

    function updateMixedPaymentUI() {
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const remaining = total - totalPaid;
        mixedTotalPaidElement.textContent = formatCurrency(totalPaid);
        mixedRemainingElement.textContent = formatCurrency(remaining);
        paymentsListElement.innerHTML = payments.map((payment, index) => `
                <div class="payment-item">
                    <div class="payment-method">
                        <i class="fas fa-${payment.method === 'cash' ? 'dollar-sign' : payment.method === 'card' ? 'credit-card' : 'qrcode'}"></i>
                        <span style="text-transform: capitalize;">${payment.method}</span>
                        ${payment.method === 'cash' ? `
                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-left: 0.5rem;">
                                Recibido: ${formatCurrency(payment.receivedAmount)}, 
                                Cambio: ${formatCurrency(payment.change)}
                            </div>
                        ` : ''}
                    </div>
                    <div class="payment-actions">
                        <span>${formatCurrency(payment.amount)}</span>
                        <button class="btn btn-outline btn-sm btn-danger" onclick="removePaymentItem(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        paymentConfirmElement.disabled = Math.abs(remaining) > 0.01;
        if (remaining <= 0) {
            document.getElementById('mixed-payment-form').style.display = 'none';
        } else {
            document.getElementById('mixed-payment-form').style.display = 'block';
        }
    }

    function removePaymentItem(index) {
        payments.splice(index, 1);
        updateMixedPaymentUI();
    }

    function processPayment() {
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        if (mixedPayment) {
            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            if (Math.abs(totalPaid - total) > 0.01) {
                return;
            }
        } else {
            const amount = total;
            const payment = {
                method: selectedPaymentMethod,
                amount
            };
            if (selectedPaymentMethod === 'cash') {
                const receivedAmount = parseFloat(singleReceivedAmountElement.value) || 0;
                if (receivedAmount < total) {
                    return;
                }
                payment.receivedAmount = receivedAmount;
                payment.change = receivedAmount - total;
            }
            payments = [payment];
        }
        closePaymentModal();
        showReceipt();
    }

    function showReceipt() {
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        receiptContentElement.innerHTML = `
                <div class="receipt-header">
                    <div class="receipt-company">Mi Empresa</div>
                    <p>${new Date().toLocaleString()}</p>
                    <p>Vendedor: Juan Pérez</p>
                </div>
                <div class="receipt-items">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th style="text-align: right;">Cant.</th>
                                <th style="text-align: right;">Precio</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td style="text-align: right;">${item.quantity}</td>
                                    <td style="text-align: right;">${formatCurrency(item.price)}</td>
                                    <td style="text-align: right;">${formatCurrency(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div>
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(subtotal)}</span>
                    </div>
                    <div class="summary-row">
                        <span>IVA (16%):</span>
                        <span>${formatCurrency(tax)}</span>
                    </div>
                    <div class="summary-row summary-total">
                        <span>Total:</span>
                        <span>${formatCurrency(total)}</span>
                    </div>
                </div>
                <div style="margin-top: 1rem; border-top: 1px solid var(--color-border); padding-top: 0.5rem;">
                    <h3 style="font-weight: 500; margin-bottom: 0.5rem;">Método de pago:</h3>
                    ${payments.map(payment => `
                        <div class="summary-row">
                            <div style="display: flex; align-items: center; gap: 0.25rem;">
                                <i class="fas fa-${payment.method === 'cash' ? 'dollar-sign' : payment.method === 'card' ? 'credit-card' : 'qrcode'}" style="font-size: 0.75rem;"></i>
                                <span style="text-transform: capitalize;">${payment.method}</span>
                            </div>
                            <span>${formatCurrency(payment.amount)}</span>
                        </div>
                    `).join('')}
                    
                    ${payments.some(p => p.method === 'cash' && p.receivedAmount) ? `
                        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-secondary);">
                            ${payments.filter(p => p.method === 'cash').map(payment => `
                                Efectivo recibido: ${formatCurrency(payment.receivedAmount)}<br>
                                Cambio: ${formatCurrency(payment.change)}
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="receipt-footer">
                    ¡Gracias por su compra!
                </div>
            `;
        receiptModalElement.classList.add('active');
    }

    function printReceipt() {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                    <html>
                        <head>
                            <title>Comprobante de Venta</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                table { width: 100%; border-collapse: collapse; }
                                th, td { padding: 5px; text-align: left; }
                                .text-right { text-align: right; }
                                .text-center { text-align: center; }
                                .receipt-header { text-align: center; margin-bottom: 20px; }
                                .receipt-company { font-weight: bold; font-size: 18px; }
                                .receipt-items { margin: 20px 0; }
                                .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                                .summary-total { font-weight: bold; }
                                .receipt-footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; }
                            </style>
                        </head>
                        <body>
                            ${receiptContentElement.innerHTML}
                        </body>
                    </html>
                `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    function finishSale() {
        receiptModalElement.classList.remove('active');
        cart = [];
        renderCart();
    }

    // ---------------------------
    // Paginación de Tabs (para la navegación en el POS)
    // ---------------------------
    let currentPageIndex = 0;
    let totalPages = 1;
    function updatePagination() {
        const tabButtons = document.querySelectorAll('.tab-button');
        totalPages = tabButtons.length;
        document.getElementById('total-pages').textContent = totalPages;
        const activeTab = document.querySelector('.tab-button.active');
        currentPageIndex = activeTab ? Array.from(tabButtons).indexOf(activeTab) : 0;
        document.getElementById('current-page').textContent = currentPageIndex + 1;
    }
    function showTab(index) {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        if(index < 0 || index >= tabButtons.length) return;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons[index].classList.add('active');
        const tabId = tabButtons[index].getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        currentPageIndex = index;
        document.getElementById('current-page').textContent = currentPageIndex + 1;
    }
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    prevPageBtn.addEventListener('click', function() {
        if (currentPageIndex > 0) {
            showTab(currentPageIndex - 1);
        }
    });
    nextPageBtn.addEventListener('click', function() {
        if (currentPageIndex < totalPages - 1) {
            showTab(currentPageIndex + 1);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            prevPageBtn.click();
        } else if (e.key === 'ArrowRight') {
            nextPageBtn.click();
        } else if (e.key === 'Escape' && paymentModalElement.classList.contains('active')) {
            closePaymentModal();
        }
    });
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.setAttribute('tabindex', '0');
        button.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
});
