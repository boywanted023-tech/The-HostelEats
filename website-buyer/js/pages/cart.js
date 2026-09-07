(function () {
  'use strict';

  const Cart = {
    KEY: 'cart',

    get() { return window.Helpers.getCart(); },

    save(cart) { window.Helpers.setCart(cart); },

    add(vendorId, item, quantity = 1) {
      const cart = this.get();
      if (cart.vendorId && cart.vendorId !== vendorId) {
        if (!confirm('Your cart has items from another vendor. Clear and start fresh?')) return false;
        this.clear();
        return this.add(vendorId, item, quantity);
      }
      cart.vendorId = vendorId;
      cart.items = cart.items || [];
      const existing = cart.items.find(i => i.menuItemId === item._id);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.items.push({
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity
        });
      }
      this.save(cart);
      window.Helpers.toast(`${item.name} added to cart`, 'success');
      return true;
    },

    update(menuItemId, quantity) {
      const cart = this.get();
      if (!cart.items) return;
      const item = cart.items.find(i => i.menuItemId === menuItemId);
      if (!item) return;
      if (quantity <= 0) {
        this.remove(menuItemId);
        return;
      }
      item.quantity = quantity;
      this.save(cart);
    },

    remove(menuItemId) {
      const cart = this.get();
      cart.items = (cart.items || []).filter(i => i.menuItemId !== menuItemId);
      if (!cart.items.length) this.clear();
      else this.save(cart);
    },

    clear() { localStorage.removeItem(this.KEY); window.Helpers.updateCartBadge(); },

    total() {
      const cart = this.get();
      return (cart.items || []).reduce((sum, i) => sum + (i.price * i.quantity), 0);
    },

    count() {
      const cart = this.get();
      return (cart.items || []).reduce((sum, i) => sum + i.quantity, 0);
    }
  };

  window.Cart = Cart;
})();