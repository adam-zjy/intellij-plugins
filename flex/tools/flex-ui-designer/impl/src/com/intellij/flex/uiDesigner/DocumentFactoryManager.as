package com.intellij.flex.uiDesigner {
public class DocumentFactoryManager {
  private const factories:Vector.<DocumentFactory> = new Vector.<DocumentFactory>();
  
  private var server:Server;

  public function DocumentFactoryManager(server:Server) {
    this.server = server;
  }

  public static function getInstance(project:Project):DocumentFactoryManager {
    return DocumentFactoryManager(project.getComponent(DocumentFactoryManager));
  }

  public function get(id:int):DocumentFactory {
    return factories[id];
  }
  
  public function get2(id:int, requestor:DocumentFactory):DocumentFactory {
    var documentFactory:DocumentFactory = factories[id];
    documentFactory.addUser(requestor);
    return documentFactory;
  }

  public function register(factory:DocumentFactory):void {
    var id:int = factory.id;
    assert(id == factories.length || (id < factories.length && factories[id] == null));
    factories[id] = factory;
  }
  
  public function unregister(document:Document):void {
    var factory:DocumentFactory = document.documentFactory;
    factory.document = null;
    if (document.systemManager != null) {
      document.systemManager.removeEventHandlers();
    }

    var deleted:Vector.<int> = new Vector.<int>();
    var id:int = unregister2(factory, deleted);
    if (id == -1) {
      return;
    }

    for each (var deletedIndex:int in deleted) {
      factories[deletedIndex] = null;
    }
    
    server.unregisterDocumentFactories(factory.module, deleted);
  }

  private function unregister2(factory:DocumentFactory, deleted:Vector.<int>):int {
    if (factory.hasUsers) {
      return -1;
    }

    var id:int;
    // find factories, required only for this factory — we need delete them
    for (var i:int = 0, n:int = factories.length; i < n; i++) {
      var f:DocumentFactory = factories[i];
      if (f == factory) {
        id = i;
      }
      else if (f != null) {
        if (f.deleteUser(factory) && f.document == null) {
          unregister2(f, deleted);
        }
      }
    }

    assert(id != -1);
    deleted[deleted.length] = id;
    return id;
  }

  //noinspection JSMethodCanBeStatic
  public function findElementAddress(object:Object, document:Document):ElementAddress {
    var factory:DocumentFactory = document.documentFactory;
    var textOffset:int = factory.getObjectDeclarationPosition(object);
    if (textOffset == -1) {
      trace("Can't find document for object");
      return null;
    }
    else {
      return new ElementAddress(factory, textOffset);
    }
  }

  public function jumpToObjectDeclaration(object:Object, document:Document):void {
    var elementAddress:ElementAddress = findElementAddress(object, document);
    if (elementAddress != null) {
      server.openDocument(elementAddress.factory.module, elementAddress.factory, elementAddress.offset);
    }
  }
}
}
