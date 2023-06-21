import { Component, OnInit } from '@angular/core';
import { CollectionReference, DocumentData, DocumentReference, Firestore, addDoc, collection, collectionData, doc, docData, getDocs, query, setDoc, where } from '@angular/fire/firestore';
import { AuthService } from '../shared/auth.service';
import { Observable } from 'rxjs';
import { User } from 'src/models/user.class';
import { Dm } from 'src/models/dm.class';
import { Router } from '@angular/router';
import { SearchTermService } from '../shared/search-term.service';

@Component({
  selector: 'app-create-dm',
  templateUrl: './create-dm.component.html',
  styleUrls: ['./create-dm.component.scss']
})
export class CreateDmComponent implements OnInit {

  private userColl: CollectionReference<DocumentData>;
  users$: Observable<any>;
  allUsers: { id: string, name: string, mail: string, password: string, profileImageUrl: string }[] = [];
  filterAllUsers: { id: string, name: string, mail: string, password: string, profileImageUrl: string }[] = [];


  currentUser: User;
  userRef: any;
  userData$: Observable<User>;
  userId: string;

  receivingRef: any;

  chat: Dm = new Dm;
  existingChatId: string;

  constructor(private firestore: Firestore, private auth: AuthService, private router: Router, private searchTerm: SearchTermService) {
    this.userColl = collection(this.firestore, 'users');
  }

  ngOnInit() {
    this.getCurrentUser();
    this.getUsers();

    this.searchTerm.searchTermChange.subscribe((searchTerm: string) => {
      this.onSearchTermChange(searchTerm);
    
    });
    
  }


  // retrieves the data of all users and assigns it to this.allUsers. It also updates filtered messages based on the retrieved data
  getUsers() {
    this.users$ = collectionData(this.userColl, { idField: 'id' })
    this.users$.subscribe(change => {
      this.allUsers = change;
      this.updateFilteredMessages()
    });
  }


  //  retrieves the current user's data and assigns it to this.currentUser.
  getCurrentUser() {
    this.userId = this.auth.userUID;
    this.userColl = collection(this.firestore, 'users');
    this.userRef = doc(this.userColl, this.userId);
    this.userData$ = docData(this.userRef);
    this.userData$.subscribe(data => {
      this.currentUser = data;
    });
  }


  // checks if a chat with the recipient exists. If yes, it redirects to the existing chat; otherwise, it creates a new chat and redirects to it
  async startChat(recipientUserId: string) {
    const exists = await this.checkExistingChat(recipientUserId)
    if (exists) {
      this.redirectToChat(this.existingChatId);
    } else {
      this.fillDmObject(recipientUserId);
      this.addDmDocumentToCurrentUser()
        .then((docRef) => {
          const documentId = docRef.id;
          this.addDmDocumentToReceivingUser(recipientUserId, documentId);
          this.redirectToChat(documentId);
        });
    }
  }


  // checks if a chat with the recipient exists and returns true if it does, otherwise false
  async checkExistingChat(recipientUserId: string) {
    const currentUserDms = collection(this.userRef, 'dms');
    const dmQuery = query(currentUserDms, where('participants', 'array-contains', recipientUserId));
    const querySnapshot = await getDocs(dmQuery); 
    if (!querySnapshot.empty) {
      console.log(querySnapshot.size);
      this.existingChatId = querySnapshot.docs[0].id;
      return true;
    } else {
      return false;
    }
  }


  // sets the participants property of this.chat with user IDs
  fillDmObject(recipientUserId: string) {
    this.chat.participants = [this.userId, recipientUserId];
  }


  // creates and returns a promise with the reference to a new direct message document within the current user's collection
  addDmDocumentToCurrentUser(): Promise<DocumentReference<DocumentData>> {
    return new Promise((resolve, reject) => {
      const dmColl = collection(this.userRef, 'dms');
      const docRef = addDoc(dmColl, this.chat.toJSON());
      resolve(docRef);
    });
  }


  // adds a direct message document to the receiving user's collection.
  addDmDocumentToReceivingUser(recipientUserId: string, documentId: string) {
    this.receivingRef = doc(this.userColl, recipientUserId);
    const dmColl = collection(this.receivingRef, 'dms')
    const docRef = doc(dmColl, documentId);
    setDoc(docRef, this.chat.toJSON());
  }


  // redirects the user to a chat page identified by the documentId using the router.
  redirectToChat(documentId: string) {
    const chatUrl = `/app/(chats:dms/${documentId})`;
    this.router.navigateByUrl(chatUrl);
  }


  // updates filteredMessages based on the search term, displaying all messages if the search term is empty or filtering messages by matching the term in the text or user name
  onSearchTermChange(searchTerm: string) {
    if (searchTerm.trim() === '') {
       this.filterAllUsers = this.allUsers;
    } else {
       searchTerm = searchTerm.toLowerCase();
       this.filterAllUsers = this.allUsers.filter(message => {
          const userName = message.name.toLowerCase();
          return userName.includes(searchTerm);
       });
    }
 }


  // copies all messages from allMessages to filteredMessages.
  async updateFilteredMessages() {
    this.filterAllUsers = [...this.allUsers];
 }
}
